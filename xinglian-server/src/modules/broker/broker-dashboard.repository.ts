import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

/** 绑定商家数：referrer_id 指向经纪人 */
export async function countLockedUsersByReferrer(referrerUserId: number, role: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users
     WHERE referrer_id = ? AND role = ? AND status = 1 AND deleted_at IS NULL`,
    [referrerUserId, role]
  );
  return Number(rows[0]?.c ?? 0);
}

export async function sumBrokerIncome(
  brokerUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(COALESCE(broker_income, 0)), 0) AS s
     FROM orders
     WHERE broker_user_id = ?
       AND order_status = 4
       AND split_calculated_at IS NOT NULL
       AND split_calculated_at >= ? AND split_calculated_at < ?`,
    [brokerUserId, start, endExclusive]
  );
  return Number(rows[0]?.s ?? 0);
}

export async function findUnsplitPaidCompletedOrdersForBroker(brokerUserId: number): Promise<
  Array<{
    payableAmountYuan: number;
    brokerUserId: number | null;
    agentUserId: number | null;
  }>
> {
  type R = RowDataPacket & {
    payable_amount: string | number;
    broker_user_id: number | null;
    agent_user_id: number | null;
  };
  const [rows] = await dbPool.query<R[]>(
    `SELECT payable_amount, broker_user_id, agent_user_id
     FROM orders
     WHERE order_status IN (3, 4)
       AND split_calculated_at IS NULL
       AND payment_status = 1
       AND broker_user_id = ?`,
    [brokerUserId]
  );
  return rows.map((row) => ({
    payableAmountYuan: Number(row.payable_amount),
    brokerUserId: row.broker_user_id != null ? Number(row.broker_user_id) : null,
    agentUserId: row.agent_user_id != null ? Number(row.agent_user_id) : null
  }));
}

export async function brokerTotalBrokerIncomeByCnDay(
  brokerUserId: number,
  start: Date,
  endExclusive: Date
): Promise<Array<{ date: string; income: number }>> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(split_calculated_at, '%Y-%m-%d') AS dk,
            COALESCE(SUM(COALESCE(broker_income, 0)), 0) AS income
     FROM orders
     WHERE order_status = 4
       AND split_calculated_at IS NOT NULL
       AND broker_user_id = ?
       AND split_calculated_at >= ? AND split_calculated_at < ?
     GROUP BY dk
     ORDER BY dk ASC`,
    [brokerUserId, start, endExclusive]
  );
  return rows.map((r) => ({ date: String(r.dk), income: Number(r.income) }));
}
