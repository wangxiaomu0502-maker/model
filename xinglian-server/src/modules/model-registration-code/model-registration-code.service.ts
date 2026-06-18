import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

import {
  consumeModelRegistrationCode,
  countModelRegistrationCodeStats,
  countModelRegistrationCodes,
  findModelRegistrationCodePage,
  findUnusedModelRegistrationCodeByCode,
  generateModelRegistrationCode,
  insertModelRegistrationCodes,
  normalizeModelRegistrationCode
} from "./model-registration-code.repository";
import type {
  ModelRegistrationCodeListQuery,
  ModelRegistrationCodeRow
} from "./model-registration-code.types";

function mapRow(row: {
  id: number;
  code: string;
  used_by_user_id: number | null;
  used_at: Date | string | null;
  created_at: Date | string;
}): ModelRegistrationCodeRow {
  return {
    id: Number(row.id),
    code: String(row.code),
    usedByUserId: row.used_by_user_id == null ? null : Number(row.used_by_user_id),
    usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function listModelRegistrationCodesForAdmin(query: ModelRegistrationCodeListQuery): Promise<{
  list: ModelRegistrationCodeRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; unused: number; used: number };
}> {
  const page = query.page;
  const pageSize = query.pageSize;
  const offset = (page - 1) * pageSize;
  const [rows, total, stats] = await Promise.all([
    findModelRegistrationCodePage(offset, pageSize, query.status),
    countModelRegistrationCodes(query.status),
    countModelRegistrationCodeStats()
  ]);
  return {
    list: rows.map(mapRow),
    total,
    page,
    pageSize,
    stats
  };
}

export async function generateModelRegistrationCodesForAdmin(count: number): Promise<{
  requested: number;
  created: number;
}> {
  const target = Math.max(1, Math.min(5000, count));
  const batch = new Set<string>();
  const maxAttempts = target * 20;
  let attempts = 0;

  while (batch.size < target && attempts < maxAttempts) {
    attempts += 1;
    batch.add(generateModelRegistrationCode());
  }

  if (batch.size < target) {
    throw new AppError("failed to generate unique codes", 500, ErrorCodes.INTERNAL_ERROR);
  }

  const created = await insertModelRegistrationCodes([...batch]);
  return { requested: target, created };
}

export async function verifyModelRegistrationCodeForMiniapp(code: string): Promise<{ valid: true }> {
  const normalized = normalizeModelRegistrationCode(code);
  if (!/^[0-9A-Z]{8}$/.test(normalized)) {
    throw new AppError("授权码无效", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const row = await findUnusedModelRegistrationCodeByCode(normalized);
  if (!row) {
    throw new AppError("授权码无效或已被使用", 400, ErrorCodes.VALIDATION_ERROR);
  }
  return { valid: true };
}

export async function consumeModelRegistrationCodeForUser(
  code: string,
  userId: number
): Promise<void> {
  const normalized = normalizeModelRegistrationCode(code);
  if (!/^[0-9A-Z]{8}$/.test(normalized)) {
    throw new AppError("授权码无效", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const consumed = await consumeModelRegistrationCode(normalized, userId);
  if (!consumed) {
    throw new AppError("授权码无效或已被使用", 400, ErrorCodes.VALIDATION_ERROR);
  }
}
