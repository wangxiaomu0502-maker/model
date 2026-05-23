import type { PoolConnection } from "mysql2/promise";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type AdminOrderListRow = RowDataPacket & {
  id: number;
  order_no: string;
  merchant_user_id: number;
  model_user_id: number;
  service_type?: string;
  broker_user_id?: number | null;
  agent_user_id?: number | null;
  /** 订单完成时锁定的分账比例 JSON；无则分账时回退读 platform_split_rules */
  split_rules_snapshot?: unknown;
  booking_date: Date | string;
  duration_kind: string;
  hour_count: number | null;
  unit_price_snapshot: string | number;
  service_amount: string | number;
  platform_fee: string | number;
  payable_amount: string | number;
  model_income?: string | number | null;
  broker_income?: string | number | null;
  agent_income?: string | number | null;
  split_calculated_at?: Date | string | null;
  payment_status: number;
  payment_channel: string | null;
  paid_at: Date | string | null;
  order_status: number;
  created_at: Date | string;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  merchant_phone?: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
  model_phone?: string | null;
  broker_user_no?: string | null;
  broker_nickname?: string | null;
  broker_real_name?: string | null;
  broker_phone?: string | null;
  agent_user_no?: string | null;
  agent_nickname?: string | null;
  agent_real_name?: string | null;
  agent_company_name?: string | null;
  agent_phone?: string | null;
};

/** 订单列表/详情参与方关联（含经纪人、代理人解析） */
export const ORDER_PARTY_SELECT = `
            mu.phone AS merchant_phone,
            mdl.phone AS model_phone,
            brk.user_no AS broker_user_no,
            brk.nickname AS broker_nickname,
            brkp.real_name AS broker_real_name,
            brk.phone AS broker_phone,
            ag.user_no AS agent_user_no,
            ag.nickname AS agent_nickname,
            COALESCE(agp.real_name, ag.real_name) AS agent_real_name,
            agp.company_name AS agent_company_name,
            ag.phone AS agent_phone`;

export const ORDER_PARTY_JOINS = `
     LEFT JOIN users mu ON mu.id = o.merchant_user_id AND mu.deleted_at IS NULL
     LEFT JOIN users mref ON mref.id = mu.referrer_id AND mref.role = 3 AND mref.deleted_at IS NULL
     LEFT JOIN users mdl ON mdl.id = o.model_user_id AND mdl.deleted_at IS NULL
     LEFT JOIN users brk
       ON brk.id = COALESCE(o.broker_user_id, mref.id) AND brk.deleted_at IS NULL AND brk.role = 3
     LEFT JOIN broker_profiles brkp ON brkp.user_id = brk.id
     LEFT JOIN users ag
       ON ag.id = COALESCE(o.agent_user_id, mdl.agent_user_id)
       AND ag.deleted_at IS NULL AND ag.role = 4
     LEFT JOIN agent_profiles agp ON agp.user_id = ag.id`;

export type AdminOrderDetailDbRow = AdminOrderListRow & {
  remark: string | null;
  updated_at: Date | string;
  split_config_snapshot: unknown;
  merchant_phone: string | null;
  model_phone: string | null;
  broker_user_no: string | null;
  broker_nickname: string | null;
  broker_real_name: string | null;
  broker_phone: string | null;
  agent_user_no: string | null;
  agent_nickname: string | null;
  agent_real_name: string | null;
  agent_company_name: string | null;
  agent_phone: string | null;
};

export async function countOrdersForAdmin(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM orders"
  );
  return Number(rows[0]?.cnt ?? 0);
}

/** 创建时间在最近 `days` 天内的订单数（含当天，按服务端 MySQL 当前时间） */
export async function countOrdersCreatedInLastDays(days: number): Promise<number> {
  const d = Math.max(1, Math.min(366, Math.floor(Number(days)) || 30));
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [d]
  );
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * 按日历日汇总订单创建数（含首尾共 `days` 天：从今天回溯 days-1 日）。
 * `day` 为 `YYYY-MM-DD`，与 MySQL `CURDATE()` 同一天界线。
 */
export async function findOrderCountsGroupedByDayLastDays(
  days: number
): Promise<Array<{ date: string; count: number }>> {
  const d = Math.max(1, Math.min(366, Math.floor(Number(days)) || 30));
  const intervalDays = d - 1;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS cnt
     FROM orders
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
     ORDER BY day ASC`,
    [intervalDays]
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(String(row.day), Number(row.cnt ?? 0));
  }

  function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }
  function ymd(dt: Date): string {
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  const out: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = d - 1; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = ymd(dt);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

/** 按 `orders.order_status` 汇总全表订单数 */
export async function findOrderCountsGroupedByOrderStatus(): Promise<
  Array<{ order_status: number; cnt: number }>
> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT order_status, COUNT(*) AS cnt
     FROM orders
     GROUP BY order_status
     ORDER BY order_status ASC`
  );
  return rows.map((row) => ({
    order_status: Number(row.order_status ?? 0),
    cnt: Number(row.cnt ?? 0)
  }));
}

/** 全表应付金额合计（元，DECIMAL） */
export async function sumPayableAmountForAdmin(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(payable_amount), 0) AS total FROM orders"
  );
  const raw = rows[0]?.total;
  return typeof raw === "number" ? raw : Number(raw ?? 0);
}

export async function findOrdersPageForAdmin(
  offset: number,
  limit: number
): Promise<AdminOrderListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminOrderListRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.broker_user_id, o.agent_user_id,
            COALESCE(o.service_type, 'ordinary') AS service_type,
            o.booking_date, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.model_income, o.broker_income, o.agent_income, o.split_calculated_at,
            o.payment_status, o.payment_channel, o.paid_at, o.order_status, o.created_at,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname,
            ${ORDER_PARTY_SELECT}
     FROM orders o
     ${ORDER_PARTY_JOINS}
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
  return rows;
}

export async function countOrdersForAdminByMerchantUserId(merchantUserId: number): Promise<number> {
  const mid = Math.floor(Number(merchantUserId));
  if (!Number.isFinite(mid) || mid <= 0) return 0;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM orders o WHERE o.merchant_user_id = ?`,
    [mid]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findOrdersPageForAdminByMerchantUserId(
  merchantUserId: number,
  offset: number,
  limit: number
): Promise<AdminOrderListRow[]> {
  const mid = Math.floor(Number(merchantUserId));
  if (!Number.isFinite(mid) || mid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminOrderListRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.broker_user_id, o.agent_user_id,
            COALESCE(o.service_type, 'ordinary') AS service_type,
            o.booking_date, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.model_income, o.broker_income, o.agent_income, o.split_calculated_at,
            o.payment_status, o.payment_channel, o.paid_at, o.order_status, o.created_at,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE o.merchant_user_id = ?
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    [mid, safeLimit, safeOffset]
  );
  return rows;
}

export async function countOrdersForAdminByModelUserId(modelUserId: number): Promise<number> {
  const uid = Math.floor(Number(modelUserId));
  if (!Number.isFinite(uid) || uid <= 0) return 0;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM orders o WHERE o.model_user_id = ?`,
    [uid]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findOrdersPageForAdminByModelUserId(
  modelUserId: number,
  offset: number,
  limit: number
): Promise<AdminOrderListRow[]> {
  const uid = Math.floor(Number(modelUserId));
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminOrderListRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.broker_user_id, o.agent_user_id,
            COALESCE(o.service_type, 'ordinary') AS service_type,
            o.booking_date, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.model_income, o.broker_income, o.agent_income, o.split_calculated_at,
            o.payment_status, o.payment_channel, o.paid_at, o.order_status, o.created_at,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id
     LEFT JOIN users mdl ON mdl.id = o.model_user_id
     WHERE o.model_user_id = ?
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    [uid, safeLimit, safeOffset]
  );
  return rows;
}

export async function findOrderByIdForAdmin(orderId: number): Promise<AdminOrderDetailDbRow | null> {
  const id = Math.floor(Number(orderId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<AdminOrderDetailDbRow[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.broker_user_id, o.agent_user_id,
            COALESCE(o.service_type, 'ordinary') AS service_type,
            o.split_rules_snapshot,
            o.booking_date, o.duration_kind, o.hour_count,
            o.unit_price_snapshot, o.service_amount, o.platform_fee, o.payable_amount,
            o.model_income, o.broker_income, o.agent_income, o.split_calculated_at,
            o.payment_status, o.payment_channel, o.paid_at, o.order_status, o.created_at,
            o.remark, o.updated_at, o.split_config_snapshot,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mu.phone AS merchant_phone,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname,
            mdl.phone AS model_phone,
            brk.user_no AS broker_user_no,
            brk.nickname AS broker_nickname,
            brkp.real_name AS broker_real_name,
            brk.phone AS broker_phone,
            ag.user_no AS agent_user_no,
            ag.nickname AS agent_nickname,
            COALESCE(agp.real_name, ag.real_name) AS agent_real_name,
            agp.company_name AS agent_company_name,
            ag.phone AS agent_phone
     FROM orders o
     ${ORDER_PARTY_JOINS}
     WHERE o.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/** 分账事务内锁定订单行 */
export type OrderRowForSplitLock = RowDataPacket & {
  id: number;
  order_no: string;
  merchant_user_id: number;
  model_user_id: number;
  broker_user_id: number | null;
  agent_user_id: number | null;
  split_rules_snapshot?: unknown;
  service_type?: string;
  payable_amount: string | number;
  order_status: number;
  payment_status: number;
  split_calculated_at: Date | string | null;
};

export async function lockOrderRowForSplit(
  conn: PoolConnection,
  orderId: number
): Promise<OrderRowForSplitLock | null> {
  const id = Math.floor(Number(orderId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await conn.query<OrderRowForSplitLock[]>(
    `SELECT o.id, o.order_no, o.merchant_user_id, o.model_user_id,
            o.broker_user_id, o.agent_user_id,
            COALESCE(o.service_type, 'ordinary') AS service_type,
            o.split_rules_snapshot,
            o.payable_amount, o.order_status, o.payment_status, o.split_calculated_at
     FROM orders o
     WHERE o.id = ?
     FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export type OrderSplitUpdatePayload = {
  modelIncome: number;
  brokerIncome: number;
  agentIncome: number;
  platformFee: number;
  splitConfigSnapshotJson: string;
};

export async function updateOrderSplitFieldsIfPending(
  conn: PoolConnection,
  orderId: number,
  payload: OrderSplitUpdatePayload
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `UPDATE orders SET
       model_income = ?,
       broker_income = ?,
       agent_income = ?,
       platform_fee = ?,
       split_config_snapshot = ?,
       split_calculated_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND order_status = 4
       AND split_calculated_at IS NULL`,
    [
      payload.modelIncome,
      payload.brokerIncome,
      payload.agentIncome,
      payload.platformFee,
      payload.splitConfigSnapshotJson,
      orderId
    ]
  );
  return result.affectedRows;
}
