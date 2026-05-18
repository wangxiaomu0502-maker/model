import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

export const LedgerBizType = {
  ORDER_SPLIT_MODEL: "order_split_model",
  ORDER_SPLIT_BROKER: "order_split_broker",
  ORDER_SPLIT_AGENT: "order_split_agent",
  /** @deprecated 历史流水类型 */
  ORDER_SPLIT_MERCHANT_REFERRER: "order_split_merchant_referrer",
  ORDER_SPLIT_MODEL_REFERRER: "order_split_model_referrer"
} as const;

export type InsertLedgerEntryParams = {
  userId: number;
  amountYuan: number;
  bizType: string;
  orderId: number;
  idempotencyKey: string;
  title: string | null;
  meta: Record<string, unknown> | null;
  adminUserId: number | null;
};

export async function insertLedgerEntry(
  conn: PoolConnection,
  p: InsertLedgerEntryParams
): Promise<void> {
  await conn.query<ResultSetHeader>(
    `INSERT INTO user_account_ledger
      (user_id, amount, balance_after, biz_type, order_id, idempotency_key, title, remark, meta, admin_user_id)
     VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      p.userId,
      p.amountYuan,
      p.bizType,
      p.orderId,
      p.idempotencyKey,
      p.title,
      p.meta ? JSON.stringify(p.meta) : null,
      p.adminUserId
    ]
  );
}

/** 增加可用余额；与流水同事务调用 */
export async function incrementUserAvailableBalance(
  conn: PoolConnection,
  userId: number,
  deltaYuan: number
): Promise<void> {
  if (!(deltaYuan > 0)) return;
  await conn.query<ResultSetHeader>(
    `INSERT INTO user_account_balance (user_id, available_yuan, frozen_yuan, version)
     VALUES (?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE
       available_yuan = available_yuan + VALUES(available_yuan),
       version = version + 1`,
    [userId, deltaYuan]
  );
}
