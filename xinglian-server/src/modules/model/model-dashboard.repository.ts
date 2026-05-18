import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export async function modelOrderCount(
  modelUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM orders
     WHERE model_user_id = ?
       AND order_status NOT IN (9)
       AND created_at >= ? AND created_at < ?`,
    [modelUserId, start, endExclusive]
  );
  return Number(rows[0]?.c ?? 0);
}

/**
 * 本期已分账入账的模特侧收入（以 split_calculated_at 落入统计区间为准；未分账不入账）
 */
export async function modelSettledIncomeSum(
  modelUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(model_income), 0) AS s
     FROM orders
     WHERE model_user_id = ?
       AND order_status = 4
       AND split_calculated_at IS NOT NULL
       AND split_calculated_at >= ? AND split_calculated_at < ?`,
    [modelUserId, start, endExclusive]
  );
  return Number(rows[0]?.s ?? 0);
}

/** @deprecated use modelSettledIncomeSum */
export async function modelCompletedIncomeSum(
  modelUserId: number,
  start: Date,
  endExclusive: Date
): Promise<number> {
  return modelSettledIncomeSum(modelUserId, start, endExclusive);
}

export type ModelOrderSplitEstimateRow = {
  payableAmountYuan: number;
  brokerUserId: number | null;
  agentUserId: number | null;
};

/**
 * 在途单（1～2）：仅已支付；用于按「应付 + 分账规则」估算模特实收（与 backlog 估算一致）。
 * 不再用 COALESCE(model_income, service_amount)：分账前 model_income 常为空，service_amount 是服务费口径，与按 payable 拆账的模特实收不一致，易虚高/错位。
 * @param start/endExclusive 若均传入则按 created_at 落入本期；若均为 null 则全量在途（钱包全量用）。
 */
export async function findModelInTransitOrdersForPendingEstimate(
  modelUserId: number,
  start: Date | null,
  endExclusive: Date | null
): Promise<ModelOrderSplitEstimateRow[]> {
  let sql = `SELECT payable_amount, broker_user_id, agent_user_id
     FROM orders
     WHERE model_user_id = ?
       AND order_status IN (1, 2)
       AND payment_status = 1`;
  const params: unknown[] = [modelUserId];
  if (start != null && endExclusive != null) {
    sql += ` AND created_at >= ? AND created_at < ?`;
    params.push(start, endExclusive);
  }
  type R = RowDataPacket & {
    payable_amount: string | number;
    broker_user_id: number | null;
    agent_user_id: number | null;
  };
  const [rows] = await dbPool.query<R[]>(sql, params);
  return rows.map((row) => ({
    payableAmountYuan: Number(row.payable_amount),
    brokerUserId:
      row.broker_user_id != null ? Number(row.broker_user_id) : null,
    agentUserId: row.agent_user_id != null ? Number(row.agent_user_id) : null
  }));
}

/**
 * 模特已完工或订单已归档、视为已收款、尚未后台写入分账时间与流水（split_calculated_at IS NULL）。
 * 含 order_status 3（待商家确认完成）与 4（已完成）；不按统计周期截取，避免 backlog 在某个 Tab 漏计。
 *
 * 支付判定：仅统计 payment_status = 1（已支付）。避免 paid_at 有值但 payment_status 仍为 0 的脏数据被算成「待分账待结算」。
 */
export async function findUnsplitPaidCompletedOrdersForModel(modelUserId: number): Promise<
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
     WHERE model_user_id = ?
       AND order_status IN (3, 4)
       AND split_calculated_at IS NULL
       AND payment_status = 1`,
    [modelUserId]
  );
  return rows.map((row) => ({
    payableAmountYuan: Number(row.payable_amount),
    brokerUserId:
      row.broker_user_id != null ? Number(row.broker_user_id) : null,
    agentUserId: row.agent_user_id != null ? Number(row.agent_user_id) : null
  }));
}

/**
 * 按「已分账日」聚合模特收入（日历日）。
 * 与 `modelSettledIncomeSum` 的时间区间一致；`split_calculated_at` 为库内分账写入时间（常见为东八区 DATETIME），
 * 不再对列做 +8h（否则晚间分账会被归到次日，近7日柱图与上方「收入」汇总错位）。
 */
export async function modelIncomeGroupedBySplitCnDay(
  modelUserId: number,
  start: Date,
  endExclusive: Date
): Promise<Array<{ date: string; income: number }>> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(split_calculated_at, '%Y-%m-%d') AS dk,
       COALESCE(SUM(model_income), 0) AS income
     FROM orders
     WHERE model_user_id = ?
       AND order_status = 4
       AND split_calculated_at IS NOT NULL
       AND split_calculated_at >= ? AND split_calculated_at < ?
     GROUP BY dk
     ORDER BY dk ASC`,
    [modelUserId, start, endExclusive]
  );
  return rows.map((r) => ({ date: String(r.dk), income: Number(r.income) }));
}

/** 兼容旧名：与 modelIncomeGroupedBySplitCnDay 相同（按分账入账日） */
export async function modelIncomeGroupedByCompletedCnDay(
  modelUserId: number,
  start: Date,
  endExclusive: Date
): Promise<Array<{ date: string; income: number }>> {
  return modelIncomeGroupedBySplitCnDay(modelUserId, start, endExclusive);
}
