import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import { hashAdminPassword } from "../admin-auth/admin-auth.service";
import {
  countCsUsersForAdmin,
  deleteCsUserForAdmin,
  findAdminUserById,
  findAdminUserByUsername,
  findCsUsersPageForAdmin,
  insertCsUserForAdmin,
  updateCsUserForAdmin
} from "../admin-auth/admin-auth.repository";

function mapCsUser(row: {
  id: number;
  username: string;
  display_name: string | null;
  phone?: string | null;
  status: number;
  created_at: Date | string;
  updated_at: Date | string;
}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    phone: row.phone?.trim() || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listCsUsers(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    countCsUsersForAdmin(),
    findCsUsersPageForAdmin(offset, pageSize)
  ]);
  return {
    total,
    page,
    pageSize,
    list: rows.map(mapCsUser)
  };
}

export async function createCsUser(input: {
  username: string;
  password: string;
  displayName?: string | null;
  phone: string;
  status: number;
}) {
  const existing = await findAdminUserByUsername(input.username);
  if (existing) {
    throw new AppError("用户名已存在", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const passwordHash = await hashAdminPassword(input.password);
  const id = await insertCsUserForAdmin({
    username: input.username,
    passwordHash,
    displayName: input.displayName ?? null,
    phone: input.phone.trim(),
    status: input.status
  });
  const row = await findAdminUserById(id);
  if (!row) {
    throw new AppError("创建失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return mapCsUser(row);
}

export async function updateCsUser(
  id: number,
  patch: {
    username?: string;
    password?: string;
    displayName?: string | null;
    phone?: string;
    status?: number;
  }
) {
  const row = await findAdminUserById(id);
  if (!row || String(row.role) !== "cs") {
    throw new AppError("客服不存在", 404, ErrorCodes.NOT_FOUND);
  }

  if (patch.username && patch.username !== row.username) {
    const dup = await findAdminUserByUsername(patch.username);
    if (dup && dup.id !== id) {
      throw new AppError("用户名已存在", 400, ErrorCodes.VALIDATION_ERROR);
    }
  }

  const dbPatch: {
    username?: string;
    passwordHash?: string;
    displayName?: string | null;
    phone?: string | null;
    status?: number;
  } = {};
  if (patch.username !== undefined) dbPatch.username = patch.username;
  if (patch.password !== undefined) {
    dbPatch.passwordHash = await hashAdminPassword(patch.password);
  }
  if (patch.displayName !== undefined) dbPatch.displayName = patch.displayName;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone.trim();
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const ok = await updateCsUserForAdmin(id, dbPatch);
  if (!ok && Object.keys(dbPatch).length === 0) {
    throw new AppError("无有效更新", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const updated = await findAdminUserById(id);
  if (!updated) {
    throw new AppError("客服不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return mapCsUser(updated);
}

export async function removeCsUser(id: number): Promise<void> {
  const row = await findAdminUserById(id);
  if (!row || String(row.role) !== "cs") {
    throw new AppError("客服不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const ok = await deleteCsUserForAdmin(id);
  if (!ok) {
    throw new AppError("删除失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
}
