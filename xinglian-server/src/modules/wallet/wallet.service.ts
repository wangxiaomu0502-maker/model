import { computeBrokerLifetimePendingCommissionYuan } from "../broker/broker-dashboard.service";
import { computeModelLifetimePendingSettlementYuan } from "../model/model-dashboard.service";
import { findUserBalance, listLedgerForUser } from "./wallet.repository";

export type WalletOverviewDto = {
  availableYuan: number;
  frozenYuan: number;
  /** 业务侧预估：未完成分账/在途等综合待结 */
  pendingSettlementYuan: number;
  ledgerTableReady: boolean;
  ledger: Array<{
    id: number;
    amountYuan: number;
    balanceAfterYuan: number | null;
    bizType: string;
    bizTypeLabel: string;
    orderId: number | null;
    title: string | null;
    createdAtIso: string;
  }>;
  /** 传入下一页的 beforeId（即本页最后一条 id） */
  nextBeforeId: number | null;
};

function bizLabel(bizType: string): string {
  switch (bizType) {
    case "order_split_model":
      return "订单分账入账（模特）";
    case "order_split_broker":
    case "order_split_merchant_referrer":
      return "订单分账入账（经纪人）";
    case "order_split_agent":
    case "order_split_model_referrer":
      return "订单分账入账（代理人）";
    case "withdrawal":
      return "提现";
    case "admin_adjust":
      return "平台调整";
    default:
      return bizType || "账户变动";
  }
}

/** role：1 模特 | 3 经纪人 | 4 代理人（与后端 users.role 对齐） */
export async function buildWalletOverview(
  userId: number,
  role: number,
  opts: { beforeId?: number | null; limit?: number }
): Promise<WalletOverviewDto> {
  let pendingSettlementYuan = 0;
  if (role === 1) {
    pendingSettlementYuan = await computeModelLifetimePendingSettlementYuan(userId);
  } else if (role === 3 || role === 4) {
    pendingSettlementYuan = await computeBrokerLifetimePendingCommissionYuan(userId);
  }

  let availableYuan = 0;
  let frozenYuan = 0;
  let ledgerTableReady = true;

  const bal = await findUserBalance(userId);
  if (bal == null) {
    ledgerTableReady = false;
  } else {
    availableYuan = Number(bal.availableYuan.toFixed(2));
    frozenYuan = Number(bal.frozenYuan.toFixed(2));
  }

  const { items, nextBeforeId } = await listLedgerForUser({
    userId,
    beforeId: opts.beforeId ?? null,
    limit: opts.limit
  });

  return {
    availableYuan,
    frozenYuan,
    pendingSettlementYuan: Number(pendingSettlementYuan.toFixed(2)),
    ledgerTableReady,
    ledger: items.map((row) => ({
      id: row.id,
      amountYuan: Number(row.amountYuan.toFixed(2)),
      balanceAfterYuan:
        row.balanceAfterYuan != null ? Number(row.balanceAfterYuan.toFixed(2)) : null,
      bizType: row.bizType,
      bizTypeLabel: bizLabel(row.bizType),
      orderId: row.orderId,
      title: row.title,
      createdAtIso: row.createdAtIso
    })),
    nextBeforeId
  };
}
