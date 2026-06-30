import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { MODEL_REGISTRATION_CODE_LENGTH } from "./model-registration-code.types";

const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type CodeListRow = RowDataPacket & {
  id: number;
  code: string;
  used_by_user_id: number | null;
  used_at: Date | string | null;
  created_at: Date | string;
};

type CountRow = RowDataPacket & { cnt: number };

type StatsRow = RowDataPacket & { total: number; unused: number; used: number };

type CodeLookupRow = RowDataPacket & { id: number; code: string };

export function normalizeModelRegistrationCode(raw: string): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function generateModelRegistrationCode(): string {
  const bytes = randomBytes(MODEL_REGISTRATION_CODE_LENGTH);
  let value = "";
  for (let i = 0; i < MODEL_REGISTRATION_CODE_LENGTH; i += 1) {
    value += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return value;
}

export async function countModelRegistrationCodes(status: "all" | "unused" | "used"): Promise<number> {
  const where =
    status === "unused"
      ? "WHERE used_at IS NULL"
      : status === "used"
        ? "WHERE used_at IS NOT NULL"
        : "";
  const [rows] = await dbPool.query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM model_registration_codes ${where}`
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function countModelRegistrationCodeStats(): Promise<{
  total: number;
  unused: number;
  used: number;
}> {
  const [rows] = await dbPool.query<StatsRow[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS unused,
       SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
     FROM model_registration_codes`
  );
  const row = rows[0];
  return {
    total: Number(row?.total ?? 0),
    unused: Number(row?.unused ?? 0),
    used: Number(row?.used ?? 0)
  };
}

export async function findModelRegistrationCodePage(
  offset: number,
  limit: number,
  status: "all" | "unused" | "used"
): Promise<CodeListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const where =
    status === "unused"
      ? "WHERE used_at IS NULL"
      : status === "used"
        ? "WHERE used_at IS NOT NULL"
        : "";
  const [rows] = await dbPool.query<CodeListRow[]>(
    `SELECT id, code, used_by_user_id, used_at, created_at
     FROM model_registration_codes
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
  return rows;
}

export async function findUnusedModelRegistrationCodeByCode(
  code: string
): Promise<{ id: number; code: string } | null> {
  const normalized = normalizeModelRegistrationCode(code);
  const [rows] = await dbPool.query<CodeLookupRow[]>(
    `SELECT id, code
     FROM model_registration_codes
     WHERE code = ? AND used_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  return rows[0] ? { id: Number(rows[0].id), code: String(rows[0].code) } : null;
}

export async function insertModelRegistrationCodes(codes: string[]): Promise<number> {
  if (!codes.length) return 0;
  const placeholders = codes.map(() => "(?)").join(", ");
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT IGNORE INTO model_registration_codes (code) VALUES ${placeholders}`,
    codes
  );
  return Number(result.affectedRows ?? 0);
}

export async function consumeModelRegistrationCode(
  code: string,
  userId: number
): Promise<boolean> {
  const normalized = normalizeModelRegistrationCode(code);
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE model_registration_codes
     SET used_by_user_id = ?, used_at = CURRENT_TIMESTAMP
     WHERE code = ? AND used_at IS NULL`,
    [userId, normalized]
  );
  return Number(result.affectedRows ?? 0) > 0;
}

export async function findRegistrationCodeUsedByUserId(userId: number): Promise<boolean> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return false;
  const [rows] = await dbPool.query<CountRow[]>(
    `SELECT COUNT(*) AS cnt
     FROM model_registration_codes
     WHERE used_by_user_id = ?
     LIMIT 1`,
    [id]
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}
