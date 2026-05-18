import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type AdminPlatformBillingListRow = RowDataPacket & {
  id: number;
  order_no: string;
  platform_fee: string | number;
  paid_at: Date | string | null;
  split_calculated_at: Date | string | null;
  order_status: number;
  payable_amount: string | number;
  merchant_nickname: string | null;
  model_nickname: string | null;
};

/** 近 30 个自然日（含今天）：与后台工作台订单日趋势同一口径 `CURDATE() - 29` */
const BILLING_WHERE = `o.platform_fee > 0
  AND o.payment_status = 1
  AND o.paid_at IS NOT NULL
  AND COALESCE(o.split_calculated_at, o.paid_at) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`;

const WINDOW_DAYS = 30;

export async function aggregatePlatformBillingLast30Days(): Promise<{
  totalRows: number;
  feeSumYuan: number;
}> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(o.platform_fee), 0) AS fee_sum
     FROM orders o
     WHERE ${BILLING_WHERE}`
  );
  const row = rows[0];
  return {
    totalRows: Number(row?.cnt ?? 0),
    feeSumYuan: typeof row?.fee_sum === "number" ? row.fee_sum : Number(row?.fee_sum ?? 0)
  };
}

export async function findPlatformBillingPageLast30Days(
  offset: number,
  limit: number
): Promise<AdminPlatformBillingListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminPlatformBillingListRow[]>(
    `SELECT o.id, o.order_no, o.platform_fee, o.paid_at, o.split_calculated_at,
            o.order_status, o.payable_amount,
            mu.nickname AS merchant_nickname,
            mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE ${BILLING_WHERE}
     ORDER BY COALESCE(o.split_calculated_at, o.paid_at) DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
  return rows;
}

/**
 * 按「记账日」汇总平台服务费（`COALESCE(split_calculated_at, paid_at)` 的日历日），
 * 返回连续 `WINDOW_DAYS` 天，缺日补 0。
 */
export async function findPlatformFeeGroupedByCreditDayLast30Days(): Promise<
  Array<{ date: string; feeYuan: number }>
> {
  const d = WINDOW_DAYS;
  const intervalDays = d - 1;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(COALESCE(o.split_calculated_at, o.paid_at), '%Y-%m-%d') AS day,
            COALESCE(SUM(o.platform_fee), 0) AS fee_sum
     FROM orders o
     WHERE o.platform_fee > 0
       AND o.payment_status = 1
       AND o.paid_at IS NOT NULL
       AND COALESCE(o.split_calculated_at, o.paid_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY day
     ORDER BY day ASC`,
    [intervalDays]
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(String(row.day), typeof row.fee_sum === "number" ? row.fee_sum : Number(row.fee_sum ?? 0));
  }

  function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }
  function ymd(dt: Date): string {
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  const out: Array<{ date: string; feeYuan: number }> = [];
  const today = new Date();
  for (let i = d - 1; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = ymd(dt);
    out.push({ date: key, feeYuan: map.get(key) ?? 0 });
  }
  return out;
}
