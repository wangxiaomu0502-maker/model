import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { OrderStatus } from "./order-status";

export type OrderCsRow = RowDataPacket & {
  order_status: number;
  cs_status: number | null;
  cs_handler_admin_id: number | null;
  handler_phone: string | null;
  handler_display_name: string | null;
};

export async function findOrderCsContextById(orderId: number): Promise<OrderCsRow | null> {
  const [rows] = await dbPool.query<OrderCsRow[]>(
    `SELECT o.order_status, o.cs_status, o.cs_handler_admin_id,
            ah.phone AS handler_phone,
            ah.display_name AS handler_display_name
     FROM orders o
     LEFT JOIN admin_users ah
       ON ah.id = o.cs_handler_admin_id AND ah.role = 'cs' AND ah.status = 1
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function findFirstEnabledCsPhone(): Promise<{
  phone: string;
  displayName: string | null;
} | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT phone, display_name
     FROM admin_users
     WHERE role = 'cs' AND status = 1
       AND phone IS NOT NULL AND TRIM(phone) <> ''
     ORDER BY id ASC
     LIMIT 1`
  );
  const row = rows[0];
  if (!row) return null;
  const phone = String(row.phone ?? "").trim();
  if (!phone) return null;
  return {
    phone,
    displayName: row.display_name != null ? String(row.display_name).trim() || null : null
  };
}

/** 订单是否应对 C 端展示客服联系区块 */
export function shouldShowCsContactOnOrder(orderStatus: number, csStatus: number | null): boolean {
  if (csStatus == null) return false;
  const st = Number(orderStatus);
  if (st === OrderStatus.CANCELLED) return false;
  return st >= OrderStatus.IN_PROGRESS;
}
