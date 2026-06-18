import { RowDataPacket } from "mysql2";

import { dbPool } from "../config/db";

const columnCache = new Map<string, boolean>();

export async function hasModelExtraColumn(columnName: string): Promise<boolean> {
  const cached = columnCache.get(columnName);
  if (cached != null) return cached;

  let exists = false;
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM model_extra_data LIKE ?",
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
           AND TABLE_NAME = 'model_extra_data'
           AND COLUMN_NAME = ?`,
        [columnName]
      );
      exists = Number(rows[0]?.cnt || 0) > 0;
    } catch {
      exists = false;
    }
  }

  if (exists) {
    columnCache.set(columnName, true);
  }
  return exists;
}

export async function mexColumnExpr(columnName: string, fallbackExpr: string): Promise<string> {
  return (await hasModelExtraColumn(columnName)) ? `mex.${columnName}` : fallbackExpr;
}
