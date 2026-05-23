import type { PoolConnection } from "mysql2/promise";

import { dbPool } from "../../config/db";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import {
  computeOrderSplitForParties,
  type SplitComputationInput
} from "../split/settlement-calculator";
import { parseOrderSplitRulesSnapshot } from "../split/order-split-rules-snapshot";
import {
  incrementUserAvailableBalance,
  insertLedgerEntry,
  LedgerBizType
} from "../split/account-ledger.repository";

import {
  lockOrderRowForSplit,
  updateOrderSplitFieldsIfPending,
  type OrderRowForSplitLock
} from "./admin-order.repository";
import { findOrderByIdForAdmin } from "./admin-order.repository";
import {
  findSplitRulesById,
  findSplitRulesByServiceType,
  insertDefaultSplitRulesRow,
  normalizeSplitServiceType,
  type SplitRulesRow
} from "./split-rules.repository";
import { getOrderDetailForAdmin, type AdminOrderDetailDto } from "./admin-order.service";

const SPLIT_RULES_ID = 1;
/** 已完成 */
const ORDER_STATUS_COMPLETED = 4;
/** 已支付 */
const PAYMENT_STATUS_PAID = 1;

function roundMoney2(yuan: number): number {
  return Math.round(yuan * 100) / 100;
}

function assertSplitConservation(payableYuan: number, platform: number, model: number, mRef: number, modelRef: number): void {
  const pCents = Math.round(payableYuan * 100);
  const sumCents =
    Math.round(platform * 100) +
    Math.round(model * 100) +
    Math.round(mRef * 100) +
    Math.round(modelRef * 100);
  if (pCents !== sumCents) {
    throw new AppError(
      `分账金额守恒校验失败：应付 ${pCents} 分，分项合计 ${sumCents} 分`,
      500,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

function isMissingTableError(err: unknown): boolean {
  const e = err as { errno?: number; code?: string };
  return e?.errno === 1146 || e?.code === "ER_NO_SUCH_TABLE";
}

function isDuplicateEntryError(err: unknown): boolean {
  const e = err as { errno?: number };
  return e?.errno === 1062;
}

function assertSplitRulesValid(rules: SplitRulesRow): void {
  if (Number(rules.model_share_bp) + Number(rules.platform_fee_rate_bp) !== 10000) {
    throw new AppError("分账比例无效：模特收入 + 服务费 须等于 100%", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const feeSum =
    Number(rules.platform_share_of_fee_bp) +
    Number(rules.agent_share_of_fee_bp) +
    Number(rules.broker_share_of_fee_bp);
  if (feeSum !== 10000) {
    throw new AppError("分账比例无效：服务费内平台+代理人+经纪人须等于 100%", 500, ErrorCodes.INTERNAL_ERROR);
  }
}

function buildSplitInput(payableYuan: number, rules: SplitRulesRow): SplitComputationInput {
  return {
    payableAmountYuan: payableYuan,
    modelShareBp: Number(rules.model_share_bp),
    platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
    agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
    brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp)
  };
}

async function resolveSplitRulesForAdminOrder(row: {
  split_rules_snapshot?: unknown;
  service_type?: unknown;
}): Promise<{ rules: SplitRulesRow; source: "order_complete_snapshot" | "platform_table_live" }> {
  const parsed = parseOrderSplitRulesSnapshot(row);
  if (parsed) {
    assertSplitRulesValid(parsed);
    return { rules: parsed, source: "order_complete_snapshot" };
  }
  await insertDefaultSplitRulesRow();
  const live = await findSplitRulesByServiceType(normalizeSplitServiceType(row.service_type)) ||
    await findSplitRulesById(SPLIT_RULES_ID);
  if (!live) {
    throw new AppError("分账规则不存在", 500, ErrorCodes.INTERNAL_ERROR);
  }
  assertSplitRulesValid(live);
  return { rules: live, source: "platform_table_live" };
}

async function appendSplitLedgers(
  conn: PoolConnection,
  lockedOrder: OrderRowForSplitLock,
  amounts: {
    modelIncome: number;
    brokerIncome: number;
    agentIncome: number;
  },
  adminUserId: number
): Promise<void> {
  const oid = Number(lockedOrder.id);
  const orderNo = String(lockedOrder.order_no);
  const metaBase = { orderNo };

  const push = async (
    userId: number,
    amount: number,
    bizType: string,
    idemSuffix: string,
    title: string
  ): Promise<void> => {
    if (!(amount > 0)) return;
    const idempotencyKey = `ORDER_SPLIT:${oid}:${idemSuffix}`;
    await insertLedgerEntry(conn, {
      userId,
      amountYuan: amount,
      bizType,
      orderId: oid,
      idempotencyKey,
      title,
      meta: metaBase,
      adminUserId
    });
    await incrementUserAvailableBalance(conn, userId, amount);
  };

  await push(
    Number(lockedOrder.model_user_id),
    amounts.modelIncome,
    LedgerBizType.ORDER_SPLIT_MODEL,
    "MODEL",
    `订单收入（模特）#${orderNo}`
  );

  const mRefUid =
    lockedOrder.broker_user_id != null ? Number(lockedOrder.broker_user_id) : null;
  if (mRefUid != null && Number.isFinite(mRefUid) && amounts.brokerIncome > 0) {
    await push(
      mRefUid,
      amounts.brokerIncome,
      LedgerBizType.ORDER_SPLIT_BROKER,
      "BROKER",
      `订单服务费分成（经纪人）#${orderNo}`
    );
  }

  const modelRefUid =
    lockedOrder.agent_user_id != null ? Number(lockedOrder.agent_user_id) : null;
  if (modelRefUid != null && Number.isFinite(modelRefUid) && amounts.agentIncome > 0) {
    await push(
      modelRefUid,
      amounts.agentIncome,
      LedgerBizType.ORDER_SPLIT_AGENT,
      "AGENT",
      `订单服务费分成（代理人）#${orderNo}`
    );
  }
}

/** 分账预览（不落库，与执行分账同一套计算逻辑） */
export type AdminOrderSplitPreviewDto = {
  orderId: number;
  orderNo: string;
  serviceType: "ordinary" | "agent";
  payableAmountYuan: number;
  platformFeeRateBp: number;
  modelShareBp: number;
  platformShareOfFeeBp: number;
  brokerShareOfFeeBp: number;
  agentShareOfFeeBp: number;
  amountsYuan: {
    platformFee: number;
    modelIncome: number;
    brokerIncome: number;
    agentIncome: number;
  };
  modelUserId: number;
  brokerUserId: number | null;
  agentUserId: number | null;
  /** 使用的分账比例来源：订单完成时锁定 / 无快照时读当前配置表 */
  rulesSource: "order_complete_snapshot" | "platform_table_live";
};

/**
 * 预览即将执行的分账结果（不写库）。
 */
export async function previewOrderSplitForAdmin(orderId: number): Promise<AdminOrderSplitPreviewDto> {
  const row = await findOrderByIdForAdmin(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }

  if (Number(row.order_status) !== ORDER_STATUS_COMPLETED) {
    throw new AppError("仅「已完成」状态的订单可以预览分账", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (Number(row.payment_status) !== PAYMENT_STATUS_PAID) {
    throw new AppError("订单未支付（或已退款），不可分账", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (row.split_calculated_at != null) {
    throw new AppError("该订单已分账", 409, ErrorCodes.VALIDATION_ERROR);
  }

  const payableYuan = Number(row.payable_amount);
  if (!Number.isFinite(payableYuan) || payableYuan <= 0) {
    throw new AppError("订单应付金额无效，无法分账", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const { rules, source } = await resolveSplitRulesForAdminOrder(row);

  const brokerUserId =
    row.broker_user_id != null ? Number(row.broker_user_id) : null;
  const agentUserId = row.agent_user_id != null ? Number(row.agent_user_id) : null;

  const finalized = computeOrderSplitForParties(buildSplitInput(payableYuan, rules), {
    brokerUserId,
    agentUserId
  });

  const platformFee = roundMoney2(finalized.platformFeeYuan);
  const modelIncome = roundMoney2(finalized.modelIncomeYuan);
  const brokerIncome = roundMoney2(finalized.brokerIncomeYuan);
  const agentIncome = roundMoney2(finalized.agentIncomeYuan);

  assertSplitConservation(payableYuan, platformFee, modelIncome, brokerIncome, agentIncome);

  return {
    orderId: row.id,
    orderNo: String(row.order_no),
    payableAmountYuan: payableYuan,
    serviceType: normalizeSplitServiceType(row.service_type),
    platformFeeRateBp: Number(rules.platform_fee_rate_bp),
    modelShareBp: Number(rules.model_share_bp),
    platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
    brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp),
    agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
    amountsYuan: {
      platformFee,
      modelIncome,
      brokerIncome,
      agentIncome
    },
    modelUserId: Number(row.model_user_id),
    brokerUserId,
    agentUserId,
    rulesSource: source
  };
}

/**
 * 管理端手动分账：优先按订单完成时锁定的分账快照计算（无则读当前 platform_split_rules），写分项与流水。
 */
export async function runManualOrderSplitForAdmin(
  orderId: number,
  adminUserId: number
): Promise<AdminOrderDetailDto> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const locked = await lockOrderRowForSplit(conn, orderId);
    if (!locked) {
      throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (Number(locked.order_status) !== ORDER_STATUS_COMPLETED) {
      throw new AppError("仅「已完成」状态的订单可以分账", 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (Number(locked.payment_status) !== PAYMENT_STATUS_PAID) {
      throw new AppError("订单未支付（或已退款），不可分账", 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (locked.split_calculated_at != null) {
      throw new AppError("该订单已分账，请勿重复操作", 409, ErrorCodes.VALIDATION_ERROR);
    }

    const payableYuan = Number(locked.payable_amount);
    if (!Number.isFinite(payableYuan) || payableYuan <= 0) {
      throw new AppError("订单应付金额无效，无法分账", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { rules, source } = await resolveSplitRulesForAdminOrder(locked);

    const brokerUserId =
      locked.broker_user_id != null ? Number(locked.broker_user_id) : null;
    const agentUserId =
      locked.agent_user_id != null ? Number(locked.agent_user_id) : null;

    const finalized = computeOrderSplitForParties(buildSplitInput(payableYuan, rules), {
      brokerUserId,
      agentUserId
    });

    const platformFee = roundMoney2(finalized.platformFeeYuan);
    const modelIncome = roundMoney2(finalized.modelIncomeYuan);
    const brokerIncome = roundMoney2(finalized.brokerIncomeYuan);
    const agentIncome = roundMoney2(finalized.agentIncomeYuan);

    assertSplitConservation(payableYuan, platformFee, modelIncome, brokerIncome, agentIncome);

    const splitConfigSnapshot = {
      version: "v2",
      source: "admin_manual_split",
      rulesResolvedFrom: source,
      orderId: locked.id,
      orderNo: locked.order_no,
      serviceType: normalizeSplitServiceType(locked.service_type),
      payableAmountYuan: payableYuan,
      platformFeeRateBp: Number(rules.platform_fee_rate_bp),
      modelShareBp: Number(rules.model_share_bp),
      platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
      brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp),
      agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
      amountsYuan: {
        platformFee,
        modelIncome,
        brokerIncome,
        agentIncome
      },
      brokerUserId,
      agentUserId,
      adminUserId
    };

    const affected = await updateOrderSplitFieldsIfPending(conn, locked.id, {
      modelIncome,
      brokerIncome,
      agentIncome,
      platformFee,
      splitConfigSnapshotJson: JSON.stringify(splitConfigSnapshot)
    });

    if (affected !== 1) {
      throw new AppError("分账失败：订单状态已变化或已分账", 409, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      await appendSplitLedgers(
        conn,
        locked,
        { modelIncome, brokerIncome, agentIncome },
        adminUserId
      );
    } catch (e) {
      if (isMissingTableError(e)) {
        throw new AppError(
          "数据库未创建账户流水表，请先执行 sql/create-user-account-ledger.sql",
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (isDuplicateEntryError(e)) {
        throw new AppError("分账幂等冲突（流水已存在），请勿重复提交", 409, ErrorCodes.VALIDATION_ERROR);
      }
      throw e;
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const detail = await getOrderDetailForAdmin(orderId);
  if (!detail) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return detail;
}
