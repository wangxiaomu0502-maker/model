import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

import { OrderStatus } from "./order-status";

export type OrderHeaderRow = RowDataPacket & {
  id: number;
  merchant_user_id: number;
  model_user_id: number;
  service_type: string;
  order_status: number;
  booking_date: Date | string;
};

export type OrderListRow = RowDataPacket & {
  id: number;
  order_no: string;
  booking_date: Date | string;
  duration_kind: string;
  service_type: string;
  hour_count: number | null;
  payable_amount: string | number;
  order_status: number;
  payment_status: number;
  created_at: Date | string;
  counterpart_user_no: string | null;
  counterpart_nickname: string | null;
};

export type OrderDetailRow = RowDataPacket & {
  id: number;
  order_no: string;
  merchant_user_id: number;
  model_user_id: number;
  booking_date: Date | string;
  duration_kind: string;
  service_type: string;
  hour_count: number | null;
  unit_price_snapshot: string | number;
  service_amount: string | number;
  platform_fee: string | number;
  payable_amount: string | number;
  payment_status: number;
  payment_channel: string | null;
  wechat_transaction_id: string | null;
  refund_no: string | null;
  wechat_refund_id: string | null;
  refund_status: string | null;
  refund_amount: string | number | null;
  refunded_at: Date | string | null;
  paid_at: Date | string | null;
  order_status: number;
  remark: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
};

export type OrderDurationKindDb = "full_day" | "half_day" | "hourly";

export type InsertOrderRow = {
  orderNo: string;
  merchantUserId: number;
  modelUserId: number;
  serviceType: "ordinary" | "agent";
  bookingDate: string;
  durationKind: OrderDurationKindDb;
  hourCount: number | null;
  unitPriceSnapshot: number;
  serviceAmount: number;
  platformFee: number;
  payableAmount: number;
  paymentStatus: number;
  paymentChannel: string | null;
  paidAt: Date | null;
  orderStatus: number;
  remark?: string | null;
};

export async function insertOrder(row: InsertOrderRow): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO orders (
       order_no, merchant_user_id, model_user_id, service_type,
       booking_date, duration_kind, hour_count,
       unit_price_snapshot, service_amount, platform_fee, payable_amount,
       payment_status, payment_channel, paid_at, order_status, remark
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      row.orderNo,
      row.merchantUserId,
      row.modelUserId,
      row.serviceType,
      row.bookingDate,
      row.durationKind,
      row.hourCount,
      row.unitPriceSnapshot,
      row.serviceAmount,
      row.platformFee,
      row.payableAmount,
      row.paymentStatus,
      row.paymentChannel,
      row.paidAt,
      row.orderStatus,
      row.remark ?? null
    ]
  );
  return Number(result.insertId);
}

export async function findOrderHeaderById(orderId: number): Promise<OrderHeaderRow | null> {
  const [rows] = await dbPool.query<OrderHeaderRow[]>(
    `SELECT id, merchant_user_id, model_user_id, COALESCE(service_type, 'ordinary') AS service_type,
            order_status, booking_date
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function updateOrderStatus(orderId: number, orderStatus: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [orderStatus, orderId]
  );
  return result.affectedRows > 0;
}

export async function updateOrderStatusAndRemark(
  orderId: number,
  orderStatus: number,
  remark: string | null
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET order_status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [orderStatus, remark, orderId]
  );
  return result.affectedRows > 0;
}

export async function cancelUnpaidAwaitingPaymentOrder(
  orderId: number,
  remark: string | null
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       order_status = ?,
       remark = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND order_status = ?
       AND payment_status = 0`,
    [OrderStatus.CANCELLED, remark, orderId, OrderStatus.AWAITING_PAYMENT]
  );
  return result.affectedRows > 0;
}

/**
 * 商家确认服务完成：锁定经纪人/代理人 + 分账规则快照，并置为已完成。
 */
export async function updateOrderToCompletedWithSplitParties(
  orderId: number,
  brokerUserId: number | null,
  agentUserId: number | null,
  splitRulesSnapshotJson: string
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       order_status = ?,
       broker_user_id = ?,
       agent_user_id = ?,
       split_rules_snapshot = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND order_status = ?`,
    [
      OrderStatus.COMPLETED,
      brokerUserId,
      agentUserId,
      splitRulesSnapshotJson,
      orderId,
      OrderStatus.MODEL_FINISHED
    ]
  );
  return result.affectedRows > 0;
}

export async function countOrdersForParticipant(params: {
  userId: number;
  side: "merchant" | "model";
  status?: number;
}): Promise<number> {
  const col = params.side === "merchant" ? "merchant_user_id" : "model_user_id";
  const clauses: string[] = [`o.${col} = ?`];
  const values: unknown[] = [params.userId];
  if (params.status !== undefined) {
    clauses.push("o.order_status = ?");
    values.push(params.status);
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

export async function findOrdersForParticipant(params: {
  userId: number;
  side: "merchant" | "model";
  status?: number;
  limit: number;
  offset: number;
}): Promise<OrderListRow[]> {
  const safeLimit = Math.max(1, Math.min(50, params.limit));
  const safeOffset = Math.max(0, params.offset);
  const joinUserExpr =
    params.side === "merchant"
      ? "LEFT JOIN users cu ON cu.id = o.model_user_id"
      : "LEFT JOIN users cu ON cu.id = o.merchant_user_id";
  const col = params.side === "merchant" ? "merchant_user_id" : "model_user_id";
  const clauses: string[] = [`o.${col} = ?`];
  const values: unknown[] = [params.userId];
  if (params.status !== undefined) {
    clauses.push("o.order_status = ?");
    values.push(params.status);
  } else {
    clauses.push("o.order_status <> ?");
    values.push(OrderStatus.CANCELLED);
  }
  values.push(safeLimit, safeOffset);
  const [rows] = await dbPool.query<OrderListRow[]>(
    `SELECT o.id, o.order_no, o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type,
            o.duration_kind, o.hour_count,
            o.payable_amount, o.order_status, o.payment_status, o.created_at,
            cu.user_no AS counterpart_user_no,
            cu.nickname AS counterpart_nickname
     FROM orders o
     ${joinUserExpr}
     WHERE ${clauses.join(" AND ")}
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    values
  );
  return rows;
}

export async function findOrderByOrderNo(orderNo: string): Promise<OrderDetailRow | null> {
  const [rows] = await dbPool.query<OrderDetailRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.payment_status, o.payment_channel, o.wechat_transaction_id,
            o.refund_no, o.wechat_refund_id, o.refund_status, o.refund_amount, o.refunded_at,
            o.paid_at, o.order_status, o.remark,
            o.created_at, o.updated_at,
            mu.user_no AS merchant_user_no, mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no, mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE o.order_no = ?
     LIMIT 1`,
    [orderNo]
  );
  return rows[0] ?? null;
}

/** 支付成功：未支付 → 已支付，待支付 → 待模特确认接单 */
export async function markOrderPaidByOrderNo(
  orderNo: string,
  paymentChannel: string,
  transactionId: string | null
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       payment_status = 1,
       payment_channel = ?,
       wechat_transaction_id = COALESCE(?, wechat_transaction_id),
       paid_at = CURRENT_TIMESTAMP,
       order_status = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE order_no = ?
       AND payment_status = 0`,
    [paymentChannel, transactionId, OrderStatus.PENDING_MODEL_ACCEPT, orderNo]
  );
  return result.affectedRows > 0;
}

export async function findOrderDetailRowById(orderId: number): Promise<OrderDetailRow | null> {
  const [rows] = await dbPool.query<OrderDetailRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.booking_date, COALESCE(o.service_type, 'ordinary') AS service_type, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.payment_status, o.payment_channel, o.wechat_transaction_id,
            o.refund_no, o.wechat_refund_id, o.refund_status, o.refund_amount, o.refunded_at,
            o.paid_at, o.order_status, o.remark,
            o.created_at, o.updated_at,
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

export async function markOrderRefunding(params: {
  orderId: number;
  currentOrderStatus: number;
  remark: string | null;
  refundNo: string;
  refundAmount: number;
}): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       order_status = ?,
       payment_status = 2,
       remark = ?,
       refund_no = ?,
       refund_amount = ?,
       refund_status = 'PROCESSING',
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND order_status = ?
       AND payment_status = 1
       AND payment_channel = 'wechat'`,
    [
      OrderStatus.CANCELLED,
      params.remark,
      params.refundNo,
      params.refundAmount,
      params.orderId,
      params.currentOrderStatus
    ]
  );
  return result.affectedRows > 0;
}

export async function markOrderRefundFinished(params: {
  orderId: number;
  paymentStatus: 2 | 3 | 4;
  wechatRefundId: string | null;
  refundStatus: string;
}): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       payment_status = ?,
       wechat_refund_id = COALESCE(?, wechat_refund_id),
       refund_status = ?,
       refunded_at = CASE WHEN ? = 3 THEN CURRENT_TIMESTAMP ELSE refunded_at END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND payment_status = 2`,
    [
      params.paymentStatus,
      params.wechatRefundId,
      params.refundStatus,
      params.paymentStatus,
      params.orderId
    ]
  );
  return result.affectedRows > 0;
}

export async function restoreOrderAfterRefundFailure(params: {
  orderId: number;
  previousOrderStatus: number;
  previousRemark: string | null;
}): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders SET
       order_status = ?,
       payment_status = 1,
       remark = ?,
       refund_status = 'FAILED',
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND payment_status = 2`,
    [params.previousOrderStatus, params.previousRemark, params.orderId]
  );
  return result.affectedRows > 0;
}
