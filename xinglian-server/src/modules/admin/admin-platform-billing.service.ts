import {
  aggregatePlatformBillingLast30Days,
  findPlatformBillingPageLast30Days,
  findPlatformFeeGroupedByCreditDayLast30Days
} from "./admin-platform-billing.repository";

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export type AdminPlatformBillingItemDto = {
  orderId: number;
  orderNo: string;
  platformFee: number;
  /** 计入近30日的时点：分账完成时间优先，否则为支付时间 */
  creditedAt: string | null;
  paidAt: string | null;
  splitCalculatedAt: string | null;
  orderStatus: number;
  payableAmount: number;
  merchantNickname: string;
  modelNickname: string;
};

const WINDOW_DAYS = 30;

export async function getAdminPlatformBilling(
  page: number,
  pageSize: number
): Promise<{
  days: number;
  feeTotalYuan: number;
  feeDailyLast30Days: Array<{ date: string; feeYuan: number }>;
  list: AdminPlatformBillingItemDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize)) || 20));
  const offset = (safePage - 1) * safePageSize;

  const agg = await aggregatePlatformBillingLast30Days();
  const [feeDailyLast30Days, rows] = await Promise.all([
    findPlatformFeeGroupedByCreditDayLast30Days(),
    findPlatformBillingPageLast30Days(offset, safePageSize)
  ]);

  return {
    days: WINDOW_DAYS,
    feeTotalYuan: agg.feeSumYuan,
    feeDailyLast30Days,
    total: agg.totalRows,
    page: safePage,
    pageSize: safePageSize,
    list: rows.map((r) => {
      const splitAt = toIso(r.split_calculated_at);
      const paidAt = toIso(r.paid_at);
      const creditedAt = splitAt ?? paidAt;
      return {
        orderId: Number(r.id),
        orderNo: String(r.order_no),
        platformFee: Number(r.platform_fee),
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
