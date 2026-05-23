import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { OrderStatus } from "../order/order-status";

export type BrokerOrderListRow = RowDataPacket & {
  id: number;
  order_no: string;
  booking_date: Date | string;
  service_type: string;
  duration_kind: string;
  hour_count: number | null;
  payable_amount: string | number;
  order_status: number;
  payment_status: number;
  created_at: Date | string;
  broker_user_id: number | null;
  agent_user_id: number | null;
  broker_income: string | number | null;
  agent_income: string | number | null;
  split_calculated_at: Date | string | null;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
};

export type BrokerOrderDetailRow = RowDataPacket & {
  id: number;
  order_no: string;
  merchant_user_id: number;
  model_user_id: number;
  booking_date: Date | string;
  service_type: string;
  duration_kind: string;
  hour_count: number | null;
  unit_price_snapshot: string | number;
  service_amount: string | number;
  platform_fee: string | number;
  payable_amount: string | number;
  payment_status: number;
  payment_channel: string | null;
  paid_at: Date | string | null;
  order_status: number;
  remark: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  broker_user_id: number | null;
  agent_user_id: number | null;
  broker_income: string | number | null;
  agent_income: string | number | null;
  model_income: string | number | null;
  split_calculated_at: Date | string | null;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
};

/**
 * 仅「本经纪人有佣金」的订单：
 * - 已分账：对应推荐人分成字段 > 0
 * - 已完成待分账：订单快照上为本经纪人（完成后才写入），佣金在应用层按规则预估 > 0 再纳入
 */
function brokerCommissionCandidateClause(brokerUserId: number): { sql: string; params: number[] } {
  const bid = Math.floor(Number(brokerUserId));
  return {
    sql: `(
      (o.split_calculated_at IS NOT NULL AND o.broker_user_id = ? AND COALESCE(o.broker_income, 0) > 0)
      OR (
        o.order_status = ? AND o.split_calculated_at IS NULL AND o.broker_user_id = ?
      )
    )`,
    params: [bid, OrderStatus.COMPLETED, bid]
  };
}

export async function countOrdersForBroker(
  brokerUserId: number,
  status?: number
): Promise<number> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return 0;
  const rel = brokerCommissionCandidateClause(bid);
  const clauses = [rel.sql];
  const values: unknown[] = [...rel.params];
  if (status !== undefined) {
    clauses.push("o.order_status = ?");
    values.push(status);
  } else {
    clauses.push("o.order_status <> ?");
    values.push(OrderStatus.CANCELLED);
  }
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM orders o WHERE ${clauses.join(" AND ")}`,
    values
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** 已完成、未分账、快照推荐人为本经纪人（供应用层筛预估佣金 > 0） */
export async function findUnsettledCompletedBrokerReferrerOrders(
  brokerUserId: number,
  status?: number
): Promise<BrokerOrderListRow[]> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return [];
  if (status !== undefined && status !== OrderStatus.COMPLETED) {
    return [];
  }
  const clauses = [
    "o.order_status = ?",
    "o.split_calculated_at IS NULL",
    "o.broker_user_id = ?"
  ];
  const values: unknown[] = [OrderStatus.COMPLETED, bid];
  const [rows] = await dbPool.query<BrokerOrderListRow[]>(
    `SELECT o.id, o.order_no, o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type,
            o.duration_kind, o.hour_count,
            o.payable_amount, o.order_status, o.payment_status, o.created_at,
            o.broker_user_id, o.agent_user_id,
            o.broker_income, o.agent_income,
            o.split_calculated_at,
            mu.user_no AS merchant_user_no, mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no, mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY o.id DESC`,
    values
  );
  return rows;
}

export async function findOrdersPageForBroker(
  brokerUserId: number,
  offset: number,
  limit: number,
  status?: number
): Promise<BrokerOrderListRow[]> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(50, limit));
  const safeOffset = Math.max(0, offset);
  const rel = brokerCommissionCandidateClause(bid);
  const clauses = [rel.sql];
  const values: unknown[] = [...rel.params];
  if (status !== undefined) {
    clauses.push("o.order_status = ?");
    values.push(status);
  } else {
    clauses.push("o.order_status <> ?");
    values.push(OrderStatus.CANCELLED);
  }
  values.push(safeLimit, safeOffset);
  const [rows] = await dbPool.query<BrokerOrderListRow[]>(
    `SELECT o.id, o.order_no, o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type,
            o.duration_kind, o.hour_count,
            o.payable_amount, o.order_status, o.payment_status, o.created_at,
            o.broker_user_id, o.agent_user_id,
            o.broker_income, o.agent_income,
            o.split_calculated_at,
            mu.user_no AS merchant_user_no, mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no, mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    values
  );
  return rows;
}

export async function findOrderDetailForBroker(orderId: number): Promise<BrokerOrderDetailRow | null> {
  const [rows] = await dbPool.query<BrokerOrderDetailRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.payment_status, o.payment_channel, o.paid_at, o.order_status, o.remark,
            o.created_at, o.updated_at,
            o.broker_user_id, o.agent_user_id,
            o.broker_income, o.agent_income, o.model_income,
            o.split_calculated_at,
            mu.user_no AS merchant_user_no, mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no, mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  return rows[0] ?? null;
}
