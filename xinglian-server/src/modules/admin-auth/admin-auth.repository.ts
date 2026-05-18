import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type AdminUserRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  display_name: string | null;
  status: number;
};

export async function findAdminUserByUsername(username: string): Promise<AdminUserRow | null> {
  const [rows] = await dbPool.query<AdminUserRow[]>(
    `SELECT id, username, password_hash, display_name, status
     FROM admin_users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}
