import { randomBytes } from "crypto";

import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

const MODEL_ROLE = 1;

function adminCreatedModelOpenid(): string {
  return `admin:model:${randomBytes(16).toString("hex")}`;
}

export async function findUserIdByPhoneForAdmin(
  phone: string,
  excludeUserId?: number
): Promise<number | null> {
  const params: Array<string | number> = [phone];
  let sql = `SELECT id FROM users WHERE deleted_at IS NULL AND phone = ?`;
  if (excludeUserId != null) {
    sql += " AND id <> ?";
    params.push(excludeUserId);
  }
  sql += " LIMIT 1";
  const [rows] = await dbPool.query<RowDataPacket[]>(sql, params);
  const id = rows[0]?.id;
  return id != null ? Number(id) : null;
}

export async function findAgentUserIdForModelBind(agentUserId: number): Promise<number | null> {
  const id = Math.floor(Number(agentUserId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE deleted_at IS NULL AND role = 4 AND id = ? LIMIT 1`,
    [id]
  );
  const found = rows[0]?.id;
  return found != null ? Number(found) : null;
}

export async function insertModelUserForAdmin(input: {
  userNo: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  status: number;
  agentUserId: number | null;
}): Promise<number> {
  const openid = adminCreatedModelOpenid();
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO users (
       user_no, openid, unionid, phone, role, phone_verified,
       nickname, avatar_url, verified_status, profile_audit_status, status, agent_user_id
     ) VALUES (?, ?, NULL, ?, ?, 1, ?, ?, 0, 2, ?, ?)`,
    [
      input.userNo,
      openid,
      input.phone,
      MODEL_ROLE,
      input.nickname,
      input.avatarUrl,
      input.status,
      input.agentUserId
    ]
  );
  const userId = Number(result.insertId);
  await dbPool.query(
    `INSERT INTO model_profiles (
       user_id, is_admin_created, is_available, only_local_orders, only_female_clients
     ) VALUES (?, 1, 0, 0, 0)`,
    [userId]
  );
  await dbPool.query(`INSERT INTO model_extra_data (user_id) VALUES (?)`, [userId]);
  return userId;
}
