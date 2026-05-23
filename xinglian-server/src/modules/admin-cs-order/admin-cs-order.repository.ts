import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { OrderStatus } from "../order/order-status";
import { CsOrderStatus } from "../order/order-cs-status";

export type CsOrderListRow = RowDataPacket & {
  id: number;
  order_no: string;
  booking_date: Date | string;
  duration_kind: string;
  hour_count: number | null;
  payable_amount: string | number;
  order_status: number;
  cs_status: number;
  cs_queued_at: Date | string | null;
  cs_started_at: Date | string | null;
  cs_completed_at: Date | string | null;
  cs_handler_admin_id: number | null;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
  note_count: number;
};

export type CsOrderDetailRow = CsOrderListRow & {
  merchant_user_id: number;
  model_user_id: number;
  broker_user_id: number | null;
  agent_user_id: number | null;
  resolved_broker_user_id?: number | null;
  resolved_agent_user_id?: number | null;
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
  service_amount: string | number;
  platform_fee: string | number;
  payment_status: number;
  paid_at: Date | string | null;
  created_at: Date | string;
  handler_username: string | null;
  handler_display_name: string | null;
};

export type CsOrderNoteRow = RowDataPacket & {
  id: number;
  order_id: number;
  admin_user_id: number;
  content: string;
  created_at: Date | string;
  admin_username: string | null;
  admin_display_name: string | null;
};

const CS_LIST_BASE_FROM = `
  FROM orders o
  LEFT JOIN users mu ON mu.id = o.merchant_user_id
  LEFT JOIN users mdl ON mdl.id = o.model_user_id
  LEFT JOIN (
    SELECT order_id, COUNT(*) AS cnt
    FROM order_cs_notes
    GROUP BY order_id
  ) nc ON nc.order_id = o.id
`;

const CS_LIST_WHERE = `
  o.cs_status IS NOT NULL
  AND o.order_status <> ?
`;

export async function enqueueOrderForCs(orderId: number): Promise<void> {
  await dbPool.query<ResultSetHeader>(
    `UPDATE orders
     SET cs_status = ?,
         cs_queued_at = COALESCE(cs_queued_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND order_status >= ?`,
    [CsOrderStatus.PENDING, orderId, OrderStatus.IN_PROGRESS]
  );
}

export async function countCsOrdersForAdmin(csStatus?: number): Promise<number> {
  const params: Array<number> = [OrderStatus.CANCELLED];
  let sql = `SELECT COUNT(*) AS cnt ${CS_LIST_BASE_FROM} WHERE ${CS_LIST_WHERE}`;
  if (csStatus != null) {
    sql += " AND o.cs_status = ?";
    params.push(csStatus);
  }
  const [rows] = await dbPool.query<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.cnt ?? 0);
}

export async function findCsOrdersPageForAdmin(
  offset: number,
  limit: number,
  csStatus?: number
): Promise<CsOrderListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const params: Array<number> = [OrderStatus.CANCELLED];
  let statusFilter = "";
  if (csStatus != null) {
    statusFilter = " AND o.cs_status = ?";
    params.push(csStatus);
  }
  params.push(safeLimit, safeOffset);

  const [rows] = await dbPool.query<CsOrderListRow[]>(
    `SELECT o.id, o.order_no, o.booking_date, o.duration_kind, o.hour_count,
            o.payable_amount, o.order_status,
            o.cs_status, o.cs_queued_at, o.cs_started_at, o.cs_completed_at,
            o.cs_handler_admin_id,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname,
            COALESCE(nc.cnt, 0) AS note_count
     ${CS_LIST_BASE_FROM}
     WHERE ${CS_LIST_WHERE}${statusFilter}
     ORDER BY FIELD(o.cs_status, ${CsOrderStatus.PENDING}, ${CsOrderStatus.PROCESSING}, ${CsOrderStatus.COMPLETED}),
              o.cs_queued_at DESC
     LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

export async function findCsOrderByIdForAdmin(orderId: number): Promise<CsOrderDetailRow | null> {
  const [rows] = await dbPool.query<CsOrderDetailRow[]>(
    `SELECT o.id, o.order_no, o.booking_date, o.duration_kind, o.hour_count,
            o.payable_amount, o.service_amount, o.platform_fee,
            o.order_status, o.payment_status, o.paid_at, o.created_at,
            o.cs_status, o.cs_queued_at, o.cs_started_at, o.cs_completed_at,
            o.cs_handler_admin_id,
            o.merchant_user_id, o.model_user_id, o.broker_user_id, o.agent_user_id,
            mu.user_no AS merchant_user_no,
            mu.nickname AS merchant_nickname,
            mu.phone AS merchant_phone,
            mdl.user_no AS model_user_no,
            mdl.nickname AS model_nickname,
            mdl.phone AS model_phone,
            brk.id AS resolved_broker_user_id,
            brk.user_no AS broker_user_no,
            brk.nickname AS broker_nickname,
            brkp.real_name AS broker_real_name,
            brk.phone AS broker_phone,
            ag.id AS resolved_agent_user_id,
            ag.user_no AS agent_user_no,
            ag.nickname AS agent_nickname,
            COALESCE(agp.real_name, ag.real_name) AS agent_real_name,
            agp.company_name AS agent_company_name,
            ag.phone AS agent_phone,
            COALESCE(nc.cnt, 0) AS note_count,
            ah.username AS handler_username,
            ah.display_name AS handler_display_name
     FROM orders o
     LEFT JOIN users mu ON mu.id = o.merchant_user_id AND mu.deleted_at IS NULL
     LEFT JOIN users mref ON mref.id = mu.referrer_id AND mref.role = 3 AND mref.deleted_at IS NULL
     LEFT JOIN users mdl ON mdl.id = o.model_user_id AND mdl.deleted_at IS NULL
     LEFT JOIN users brk
       ON brk.id = COALESCE(o.broker_user_id, mref.id) AND brk.deleted_at IS NULL AND brk.role = 3
     LEFT JOIN broker_profiles brkp ON brkp.user_id = brk.id
     LEFT JOIN users ag
       ON ag.id = COALESCE(o.agent_user_id, mdl.agent_user_id)
       AND ag.deleted_at IS NULL AND ag.role = 4
     LEFT JOIN agent_profiles agp ON agp.user_id = ag.id
     LEFT JOIN admin_users ah ON ah.id = o.cs_handler_admin_id
     LEFT JOIN (
       SELECT order_id, COUNT(*) AS cnt FROM order_cs_notes GROUP BY order_id
     ) nc ON nc.order_id = o.id
     WHERE o.id = ?
       AND o.cs_status IS NOT NULL
       AND o.order_status <> ?
     LIMIT 1`,
    [orderId, OrderStatus.CANCELLED]
  );
  return rows[0] ?? null;
}

export async function findCsOrderNotes(orderId: number): Promise<CsOrderNoteRow[]> {
  const [rows] = await dbPool.query<CsOrderNoteRow[]>(
    `SELECT n.id, n.order_id, n.admin_user_id, n.content, n.created_at,
            a.username AS admin_username,
            a.display_name AS admin_display_name
     FROM order_cs_notes n
     LEFT JOIN admin_users a ON a.id = n.admin_user_id
     WHERE n.order_id = ?
     ORDER BY n.id ASC`,
    [orderId]
  );
  return rows;
}

export async function startCsOrderProcessing(
  orderId: number,
  adminUserId: number
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders
     SET cs_status = ?,
         cs_started_at = CURRENT_TIMESTAMP,
         cs_handler_admin_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND cs_status = ?
       AND order_status <> ?`,
    [
      CsOrderStatus.PROCESSING,
      adminUserId,
      orderId,
      CsOrderStatus.PENDING,
      OrderStatus.CANCELLED
    ]
  );
  return result.affectedRows > 0;
}

export async function completeCsOrderProcessing(
  orderId: number,
  adminUserId: number
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE orders
     SET cs_status = ?,
         cs_completed_at = CURRENT_TIMESTAMP,
         cs_handler_admin_id = COALESCE(cs_handler_admin_id, ?),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND cs_status = ?
       AND order_status <> ?`,
    [
      CsOrderStatus.COMPLETED,
      adminUserId,
      orderId,
      CsOrderStatus.PROCESSING,
      OrderStatus.CANCELLED
    ]
  );
  return result.affectedRows > 0;
}

export async function insertCsOrderNote(
  orderId: number,
  adminUserId: number,
  content: string
): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO order_cs_notes (order_id, admin_user_id, content) VALUES (?, ?, ?)`,
    [orderId, adminUserId, content]
  );
  return Number(result.insertId);
}
