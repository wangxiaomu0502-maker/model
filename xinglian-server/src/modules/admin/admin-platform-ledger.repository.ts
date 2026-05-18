import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type AdminPlatformLedgerListRow = RowDataPacket & {
  id: number;
  order_no: string;
  platform_fee: string | number;
  paid_at: Date | string | null;
  split_calculated_at: Date | string | null;
  credited_at: Date | string;
  order_status: number;
  payable_amount: string | number;
  merchant_nickname: string | null;
  model_nickname: string | null;
  balance_after: string | number;
};

export type AdminPlatformLedgerFilters = {
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  /** all | settled | pending */
  settleStatus?: "all" | "settled" | "pending";
};

const LEDGER_BASE = `o.platform_fee > 0
  AND o.payment_status = 1
  AND o.paid_at IS NOT NULL`;

function buildFilterSql(
  filters: AdminPlatformLedgerFilters
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (filters.settleStatus === "settled") {
    parts.push("o.split_calculated_at IS NOT NULL");
  } else if (filters.settleStatus === "pending") {
    parts.push("o.split_calculated_at IS NULL");
  }

  if (filters.dateFrom) {
    parts.push("DATE(COALESCE(o.split_calculated_at, o.paid_at)) >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    parts.push("DATE(COALESCE(o.split_calculated_at, o.paid_at)) <= ?");
    params.push(filters.dateTo);
  }
  if (filters.keyword) {
    parts.push("o.order_no LIKE ?");
    params.push(`%${filters.keyword}%`);
  }

  const extra = parts.length ? ` AND ${parts.join(" AND ")}` : "";
  return { sql: `${LEDGER_BASE}${extra}`, params };
}

export async function aggregatePlatformLedger(
  filters: AdminPlatformLedgerFilters
): Promise<{ totalRows: number; feeSumYuan: number }> {
  const { sql, params } = buildFilterSql(filters);
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(o.platform_fee), 0) AS fee_sum
     FROM orders o
     WHERE ${sql}`,
    params
  );
  const row = rows[0];
  return {
    totalRows: Number(row?.cnt ?? 0),
    feeSumYuan: typeof row?.fee_sum === "number" ? row.fee_sum : Number(row?.fee_sum ?? 0)
  };
}

export async function aggregatePlatformLedgerTodayAndMonth(): Promise<{
  todayYuan: number;
  monthYuan: number;
  allTimeYuan: number;
}> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(COALESCE(o.split_calculated_at, o.paid_at)) = CURDATE()
         THEN o.platform_fee ELSE 0 END), 0) AS today_sum,
       COALESCE(SUM(CASE WHEN DATE_FORMAT(COALESCE(o.split_calculated_at, o.paid_at), '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
         THEN o.platform_fee ELSE 0 END), 0) AS month_sum,
       COALESCE(SUM(o.platform_fee), 0) AS all_sum
     FROM orders o
     WHERE ${LEDGER_BASE}`
  );
  const row = rows[0];
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  return {
    todayYuan: num(row?.today_sum),
    monthYuan: num(row?.month_sum),
    allTimeYuan: num(row?.all_sum)
  };
}

export async function findPlatformLedgerPage(
  filters: AdminPlatformLedgerFilters,
  offset: number,
  limit: number
): Promise<AdminPlatformLedgerListRow[]> {
  const { sql, params } = buildFilterSql(filters);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);

  const [rows] = await dbPool.query<AdminPlatformLedgerListRow[]>(
    `SELECT t.id, t.order_no, t.platform_fee, t.paid_at, t.split_calculated_at,
            t.credited_at, t.order_status, t.payable_amount,
            t.merchant_nickname, t.model_nickname, t.balance_after
     FROM (
       SELECT o.id, o.order_no, o.platform_fee, o.paid_at, o.split_calculated_at,
              COALESCE(o.split_calculated_at, o.paid_at) AS credited_at,
              o.order_status, o.payable_amount,
              mu.nickname AS merchant_nickname,
              mdl.nickname AS model_nickname,
              SUM(o.platform_fee) OVER (
                ORDER BY COALESCE(o.split_calculated_at, o.paid_at) ASC, o.id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS balance_after
       FROM orders o
       LEFT JOIN users mu ON mu.id = o.merchant_user_id
       LEFT JOIN users mdl ON mdl.id = o.model_user_id
       WHERE ${sql}
     ) t
     ORDER BY t.credited_at DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );
  return rows;
}
