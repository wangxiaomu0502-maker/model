import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

const DEFAULT_PAGE = 30;

function isMissingLedgerTable(err: unknown): boolean {
  const e = err as { errno?: number; code?: string };
  return e?.errno === 1146 || e?.code === "ER_NO_SUCH_TABLE";
}

export type UserBalanceDto = {
  availableYuan: number;
  frozenYuan: number;
};

/** 可读流水（用户端）；表不存在或异常时降级为空 */
export type WalletLedgerRowDto = {
  id: number;
  amountYuan: number;
  balanceAfterYuan: number | null;
  bizType: string;
  orderId: number | null;
  title: string | null;
  createdAtIso: string;
};

export async function findUserBalance(userId: number): Promise<UserBalanceDto | null> {
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COALESCE(available_yuan, 0) AS a, COALESCE(frozen_yuan, 0) AS f
       FROM user_account_balance WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) {
      return { availableYuan: 0, frozenYuan: 0 };
    }
    return {
      availableYuan: Number(row.a ?? 0),
      frozenYuan: Number(row.f ?? 0)
    };
  } catch (e) {
    if (isMissingLedgerTable(e)) {
      return null;
    }
    throw e;
  }
}

export async function listLedgerForUser(params: {
  userId: number;
  /** 上一页最后一条 id，exclusive */
  beforeId?: number | null;
  limit?: number;
}): Promise<{ items: WalletLedgerRowDto[]; nextBeforeId: number | null }> {
  const cap = Math.min(Math.max(Number(params.limit) || DEFAULT_PAGE, 1), 100);
  const beforeId =
    params.beforeId != null && Number.isFinite(Number(params.beforeId))
      ? Number(params.beforeId)
      : null;
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, amount, balance_after, biz_type, order_id, title, created_at
       FROM user_account_ledger
       WHERE user_id = ?
         AND (? IS NULL OR id < ?)
       ORDER BY id DESC
       LIMIT ${cap}`,
      [params.userId, beforeId, beforeId]
    );
    const items: WalletLedgerRowDto[] = [];
    for (const r of rows) {
      const id = Number(r.id);
      const ca = r.created_at as Date | string | null;
      const createdAtIso =
        ca instanceof Date
          ? ca.toISOString()
          : typeof ca === "string"
            ? ca
            : new Date().toISOString();
      items.push({
        id,
        amountYuan: Number(r.amount ?? 0),
        balanceAfterYuan:
          r.balance_after != null && r.balance_after !== "" ? Number(r.balance_after) : null,
        bizType: String(r.biz_type ?? ""),
        orderId: r.order_id != null ? Number(r.order_id) : null,
        title: r.title != null ? String(r.title) : null,
        createdAtIso
      });
    }
    const last = items[items.length - 1];
    const hasMore = items.length >= cap;
    return { items, nextBeforeId: hasMore && last ? last.id : null };
  } catch (e) {
    if (isMissingLedgerTable(e)) {
      return { items: [], nextBeforeId: null };
    }
    throw e;
  }
}
