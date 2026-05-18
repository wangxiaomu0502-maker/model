import {
  aggregatePlatformLedger,
  aggregatePlatformLedgerTodayAndMonth,
  findPlatformLedgerPage,
  type AdminPlatformLedgerFilters
} from "./admin-platform-ledger.repository";

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export type AdminPlatformLedgerItemDto = {
  flowNo: string;
  orderId: number;
  orderNo: string;
  amountYuan: number;
  balanceAfterYuan: number;
  bizType: "settled" | "pending";
  bizTypeLabel: string;
  creditedAt: string | null;
  paidAt: string | null;
  splitCalculatedAt: string | null;
  orderStatus: number;
  payableAmount: number;
  merchantNickname: string;
  modelNickname: string;
};

export async function getAdminPlatformLedger(
  page: number,
  pageSize: number,
  filters: AdminPlatformLedgerFilters
): Promise<{
  list: AdminPlatformLedgerItemDto[];
  total: number;
  page: number;
  pageSize: number;
  filteredTotalYuan: number;
  todayYuan: number;
  monthYuan: number;
  allTimeYuan: number;
}> {
  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize)) || 20));
  const offset = (safePage - 1) * safePageSize;

  const [agg, calendar, rows] = await Promise.all([
    aggregatePlatformLedger(filters),
    aggregatePlatformLedgerTodayAndMonth(),
    findPlatformLedgerPage(filters, offset, safePageSize)
  ]);

  return {
    total: agg.totalRows,
    filteredTotalYuan: agg.feeSumYuan,
    todayYuan: calendar.todayYuan,
    monthYuan: calendar.monthYuan,
    allTimeYuan: calendar.allTimeYuan,
    page: safePage,
    pageSize: safePageSize,
    list: rows.map((r) => {
      const splitAt = toIso(r.split_calculated_at);
      const paidAt = toIso(r.paid_at);
      const creditedAt = toIso(r.credited_at);
      const settled = splitAt != null;
      return {
        flowNo: `PF${r.id}`,
        orderId: Number(r.id),
        orderNo: String(r.order_no),
        amountYuan: Number(r.platform_fee),
        balanceAfterYuan: Number(r.balance_after),
        bizType: settled ? "settled" : "pending",
        bizTypeLabel: settled ? "已分账·服务费入账" : "已支付·待分账",
        creditedAt,
        paidAt,
        splitCalculatedAt: splitAt,
        orderStatus: Number(r.order_status),
        payableAmount: Number(r.payable_amount),
        merchantNickname: r.merchant_nickname?.trim() || "—",
        modelNickname: r.model_nickname?.trim() || "—"
      };
    })
  };
}
