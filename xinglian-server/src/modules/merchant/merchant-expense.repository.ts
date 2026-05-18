import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

/** 已支付订单应付金额合计（按 paid_at 落入区间） */
export async function merchantPaidExpenseSum(
  merchantUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS s
     FROM orders
     WHERE merchant_user_id = ?
       AND payment_status = 1
       AND paid_at IS NOT NULL
       AND paid_at >= ? AND paid_at < ?`,
    [merchantUserId, start, endExclusive]
  );
  return Number(rows[0]?.s ?? 0);
}

export async function merchantPaidOrderCount(
  merchantUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     FROM orders
     WHERE merchant_user_id = ?
       AND payment_status = 1
       AND paid_at IS NOT NULL
       AND paid_at >= ? AND paid_at < ?`,
    [merchantUserId, start, endExclusive]
  );
  return Number(rows[0]?.c ?? 0);
}

export async function merchantAllTimePaidExpenseSum(merchantUserId: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS s
     FROM orders
     WHERE merchant_user_id = ?
       AND payment_status = 1
       AND paid_at IS NOT NULL`,
    [merchantUserId]
  );
  return Number(rows[0]?.s ?? 0);
}

/** 未支付且未取消订单的应付合计 */
export async function merchantUnpaidPayableSum(merchantUserId: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS s
     FROM orders
     WHERE merchant_user_id = ?
       AND payment_status = 0
       AND order_status NOT IN (9)`,
    [merchantUserId]
  );
  return Number(rows[0]?.s ?? 0);
}

export async function merchantExpenseGroupedByPaidCnDay(
  merchantUserId: number,
  start: Date,
  endExclusive: Date
): Promise<Array<{ date: string; expense: number }>> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m-%d') AS dk,
            COALESCE(SUM(payable_amount), 0) AS expense
     FROM orders
     WHERE merchant_user_id = ?
       AND payment_status = 1
       AND paid_at IS NOT NULL
       AND paid_at >= ? AND paid_at < ?
     GROUP BY dk
     ORDER BY dk ASC`,
    [merchantUserId, start, endExclusive]
  );
  return rows.map((r) => ({ date: String(r.dk), expense: Number(r.expense) }));
}
