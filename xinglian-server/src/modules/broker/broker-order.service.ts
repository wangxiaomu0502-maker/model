import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import {
  findSplitRulesById,
  insertDefaultSplitRulesRow,
  fallbackSplitRulesRowForEstimate,
  type SplitRulesRow
} from "../admin/split-rules.repository";
import { durationKindLabel, orderStatusLabel, paymentStatusLabel } from "../order/order-status";
import { computeOrderSplit } from "../split/settlement-calculator";
import type { BrokerOrderListQuery } from "./broker.types";
import {
  countOrdersForBroker,
  findOrderDetailForBroker,
  findOrdersPageForBroker,
  findUnsettledCompletedBrokerReferrerOrders
} from "./broker-order.repository";
import type { BrokerOrderListRow } from "./broker-order.repository";

const SPLIT_RULES_ID = 1;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoDateOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length ? s : null;
}

function durationKindDbToApi(db: string): "fullDay" | "halfDay" | "hourly" {
  if (db === "full_day") return "fullDay";
  if (db === "half_day") return "halfDay";
  return "hourly";
}

function brokerRelationLabels(brokerUserId: number, orderBrokerId: number | null): string[] {
  return Number(orderBrokerId) === Math.floor(Number(brokerUserId)) ? ["商户绑定经纪人"] : [];
}

function settledBrokerCommissionYuan(
  brokerUserId: number,
  orderBrokerId: number | null,
  brokerIncome: number | null
): number {
  if (Number(orderBrokerId) !== Math.floor(Number(brokerUserId))) return 0;
  return Number(num(brokerIncome).toFixed(2));
}

function estimateBrokerCommissionYuan(
  brokerUserId: number,
  payableYuan: number,
  orderBrokerId: number | null,
  rules: SplitRulesRow
): number {
  if (Number(orderBrokerId) !== Math.floor(Number(brokerUserId))) return 0;
  const split = computeOrderSplit({
    payableAmountYuan: payableYuan,
    modelShareBp: Number(rules.model_share_bp),
    platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
    agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
    brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp)
  });
  return Number(split.brokerIncomeYuan.toFixed(2));
}

async function resolveRulesForEstimate(): Promise<SplitRulesRow> {
  await insertDefaultSplitRulesRow();
  const splitRules = await findSplitRulesById(SPLIT_RULES_ID);
  return splitRules ?? fallbackSplitRulesRowForEstimate();
}

function resolveMyCommission(
  brokerUserId: number,
  row: Pick<
    BrokerOrderListRow,
    | "payable_amount"
    | "order_status"
    | "broker_user_id"
    | "agent_user_id"
    | "broker_income"
    | "agent_income"
    | "split_calculated_at"
  >,
  rules: SplitRulesRow
): { amount: number; settled: boolean; estimate: boolean } {
  const splitAt = isoDateOrNull(row.split_calculated_at);
  const orderBrokerId =
    row.broker_user_id != null ? Number(row.broker_user_id) : null;

  if (splitAt != null) {
    const amount = settledBrokerCommissionYuan(
      brokerUserId,
      orderBrokerId,
      row.broker_income != null ? num(row.broker_income) : null
    );
    return { amount, settled: true, estimate: false };
  }

  if (Number(row.order_status) === 4) {
    const est = estimateBrokerCommissionYuan(
      brokerUserId,
      num(row.payable_amount),
      orderBrokerId,
      rules
    );
    return { amount: est, settled: false, estimate: est > 0 };
  }

  return { amount: 0, settled: false, estimate: false };
}

function mapListItem(
  row: BrokerOrderListRow,
  brokerUserId: number,
  rules: SplitRulesRow
) {
  const bd = isoDateOrNull(row.booking_date as Date | string);
  const orderBrokerId =
    row.broker_user_id != null ? Number(row.broker_user_id) : null;
  const commission = resolveMyCommission(brokerUserId, row, rules);
  const relationLabels = brokerRelationLabels(brokerUserId, orderBrokerId);

  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: bd ? bd.slice(0, 10) : "",
    durationKind: durationKindDbToApi(String(row.duration_kind || "")),
    durationKindText: durationKindLabel(row.duration_kind),
    hourCount: row.hour_count,
    payableAmount: num(row.payable_amount),
    orderStatus: row.order_status,
    orderStatusText: orderStatusLabel(row.order_status),
    paymentStatus: row.payment_status,
    paymentStatusText: paymentStatusLabel(row.payment_status),
    createdAt: isoDateOrNull(row.created_at as Date | string),
    relationLabels,
    relationText: relationLabels.join(" · ") || "推广佣金",
    merchant: {
      userNo: row.merchant_user_no ?? "",
      nickname: row.merchant_nickname ?? ""
    },
    model: {
      userNo: row.model_user_no ?? "",
      nickname: row.model_nickname ?? ""
    },
    myCommissionYuan: commission.amount,
    commissionSettled: commission.settled,
    commissionText: commission.settled
      ? `¥${commission.amount.toFixed(2)}`
      : commission.amount > 0
        ? `约 ¥${commission.amount.toFixed(2)}（待分账）`
        : ""
  };
}

async function countBrokerCommissionOrders(
  brokerUserId: number,
  status: number | undefined,
  rules: SplitRulesRow
): Promise<number> {
  const candidateTotal = await countOrdersForBroker(brokerUserId, status);
  if (candidateTotal === 0) return 0;

  const unsettledRows = await findUnsettledCompletedBrokerReferrerOrders(brokerUserId, status);
  let unsettledWithZeroEst = 0;
  for (const row of unsettledRows) {
    const c = resolveMyCommission(brokerUserId, row, rules);
    if (c.amount <= 0) unsettledWithZeroEst += 1;
  }

  return Math.max(0, candidateTotal - unsettledWithZeroEst);
}

export async function listBrokerRelatedOrders(
  brokerUserId: number,
  query: BrokerOrderListQuery
): Promise<{
  list: ReturnType<typeof mapListItem>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = query.page;
  const pageSize = query.pageSize;
  const rules = await resolveRulesForEstimate();
  const total = await countBrokerCommissionOrders(brokerUserId, query.status, rules);
  const offset = (page - 1) * pageSize;
  const rows = await findOrdersPageForBroker(brokerUserId, offset, pageSize, query.status);

  const list = rows
    .map((row) => mapListItem(row, brokerUserId, rules))
    .filter((item) => item.myCommissionYuan > 0);

  return { list, total, page, pageSize };
}

export async function getBrokerRelatedOrderDetail(
  orderId: number,
  brokerUserId: number
): Promise<Record<string, unknown>> {
  const row = await findOrderDetailForBroker(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }

  const rules = await resolveRulesForEstimate();
  const commission = resolveMyCommission(brokerUserId, row, rules);
  if (commission.amount <= 0) {
    throw new AppError("该订单与您无推广佣金关联", 403, ErrorCodes.FORBIDDEN);
  }

  const bd = isoDateOrNull(row.booking_date as Date | string);
  const splitAt = isoDateOrNull(row.split_calculated_at);
  const orderMRef =
    row.broker_user_id != null ? Number(row.broker_user_id) : null;
  const orderModelRef =
    row.agent_user_id != null ? Number(row.agent_user_id) : null;
  const payableAmount = num(row.payable_amount);
  const relationLabels = brokerRelationLabels(brokerUserId, orderMRef);

  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: bd ? bd.slice(0, 10) : "",
    durationKind: durationKindDbToApi(String(row.duration_kind || "")),
    durationKindText: durationKindLabel(row.duration_kind),
    hourCount: row.hour_count,
    unitPriceSnapshot: num(row.unit_price_snapshot),
    serviceAmount: num(row.service_amount),
    platformFee: num(row.platform_fee),
    payableAmount,
    paymentStatus: row.payment_status,
    paymentStatusText: paymentStatusLabel(row.payment_status),
    paymentChannel: row.payment_channel,
    paidAt: isoDateOrNull(row.paid_at as Date | string | null),
    orderStatus: Number(row.order_status),
    orderStatusText: orderStatusLabel(Number(row.order_status)),
    remark: row.remark ?? "",
    createdAt: isoDateOrNull(row.created_at as Date | string),
    updatedAt: isoDateOrNull(row.updated_at as Date | string),
    merchant: {
      userNo: row.merchant_user_no ?? "",
      nickname: row.merchant_nickname ?? ""
    },
    model: {
      userNo: row.model_user_no ?? "",
      nickname: row.model_nickname ?? ""
    },
    viewerRole: 3,
    brokerView: true,
    relationLabels,
    relationText: relationLabels.join(" · ") || "推广佣金",
    myCommissionYuan: commission.amount,
    commissionSettled: commission.settled,
    commissionEstimate: commission.estimate,
    commissionStatusText: commission.settled
      ? "已分账入账"
      : commission.estimate
        ? "预估（待后台分账）"
        : "待分账",
    splitCalculatedAt: splitAt,
    modelIncomeYuan: num(row.model_income),
    brokerIncomeYuan: num(row.broker_income),
    agentIncomeYuan: num(row.agent_income),
    actions: {
      modelConfirmAccept: false,
      modelConfirmService: false,
      modelCancel: false,
      merchantConfirmComplete: false,
      merchantCancel: false
    }
  };
}
