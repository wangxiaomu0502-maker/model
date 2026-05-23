import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

import type { AdminBackofficeRole } from "../../middlewares/require-admin-auth";

export type AdminUserRow = RowDataPacket & {
  id: number;
  username: string;
  role: string;
  password_hash: string;
  display_name: string | null;
  phone: string | null;
  status: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function findAdminUserByUsername(
  username: string,
  role?: AdminBackofficeRole
): Promise<AdminUserRow | null> {
  const params: string[] = [username];
  let sql = `SELECT id, username, role, password_hash, display_name, phone, status, created_at, updated_at
     FROM admin_users
     WHERE username = ?`;
  if (role) {
    sql += " AND role = ?";
    params.push(role);
  }
  sql += " LIMIT 1";
  const [rows] = await dbPool.query<AdminUserRow[]>(sql, params);
  return rows[0] ?? null;
}

export async function findAdminUserById(id: number): Promise<AdminUserRow | null> {
  const [rows] = await dbPool.query<AdminUserRow[]>(
    `SELECT id, username, role, password_hash, display_name, phone, status, created_at, updated_at
     FROM admin_users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function countCsUsersForAdmin(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM admin_users WHERE role = 'cs'`
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findCsUsersPageForAdmin(
  offset: number,
  limit: number
): Promise<AdminUserRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminUserRow[]>(
    `SELECT id, username, role, password_hash, display_name, phone, status, created_at, updated_at
     FROM admin_users
     WHERE role = 'cs'
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
  return rows;
}

export async function insertCsUserForAdmin(input: {
  username: string;
  passwordHash: string;
  displayName: string | null;
  phone: string | null;
  status: number;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO admin_users (username, role, password_hash, display_name, phone, status)
     VALUES (?, 'cs', ?, ?, ?, ?)`,
    [input.username, input.passwordHash, input.displayName, input.phone, input.status]
  );
  return Number(result.insertId);
}

export async function updateCsUserForAdmin(
  id: number,
  patch: {
    username?: string;
    passwordHash?: string;
    displayName?: string | null;
    phone?: string | null;
    status?: number;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  if (patch.username !== undefined) {
    sets.push("username = ?");
    params.push(patch.username);
  }
  if (patch.passwordHash !== undefined) {
    sets.push("password_hash = ?");
    params.push(patch.passwordHash);
  }
  if (patch.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(patch.displayName);
  }
  if (patch.phone !== undefined) {
    sets.push("phone = ?");
    params.push(patch.phone);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (!sets.length) return false;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);

  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE admin_users SET ${sets.join(", ")} WHERE id = ? AND role = 'cs'`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteCsUserForAdmin(id: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `DELETE FROM admin_users WHERE id = ? AND role = 'cs'`,
    [id]
  );
  return result.affectedRows > 0;
}
