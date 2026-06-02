import { RowDataPacket } from "mysql2";

import { dbPool } from "../config/db";

const columnCache = new Map<string, boolean>();

/** 检测 model_profiles 表是否存在某列（兼容未跑迁移的线上库） */
export async function hasModelProfilesColumn(columnName: string): Promise<boolean> {
  const cached = columnCache.get(columnName);
  if (cached != null) return cached;

  let exists = false;
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM model_profiles LIKE ?",
      [columnName]
    );
    exists = rows.length > 0;
  } catch {
    exists = false;
  }

  if (!exists) {
    try {
      const [rows] = await dbPool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'model_profiles'
           AND COLUMN_NAME = ?`,
        [columnName]
      );
      exists = Number(rows[0]?.cnt || 0) > 0;
    } catch {
      exists = false;
    }
  }

  // 只缓存已存在的列。迁移可能在服务运行中执行，缓存“不存在”会导致迁移后仍误判。
  if (exists) {
    columnCache.set(columnName, true);
  }
  return exists;
}

/** SELECT 片段：有列用 mp.col，否则用 fallback 表达式 */
export async function mpColumnExpr(columnName: string, fallbackExpr: string): Promise<string> {
  return (await hasModelProfilesColumn(columnName)) ? `mp.${columnName}` : fallbackExpr;
}
