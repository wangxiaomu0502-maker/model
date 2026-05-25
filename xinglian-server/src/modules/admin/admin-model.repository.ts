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

export async function findAdminCreatedModelUserIdForAdmin(userId: number): Promise<number | null> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT u.id
     FROM users u
     INNER JOIN model_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = ?
       AND u.id = ?
       AND mp.is_admin_created = 1
     LIMIT 1`,
    [MODEL_ROLE, id]
  );
  const found = rows[0]?.id;
  return found != null ? Number(found) : null;
}

export async function updateModelUserForAdmin(input: {
  userId: number;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  status: number;
  agentUserId: number | null;
}): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET phone = ?,
         phone_verified = 1,
         nickname = ?,
         avatar_url = ?,
         status = ?,
         agent_user_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = ? AND deleted_at IS NULL`,
    [
      input.phone,
      input.nickname,
      input.avatarUrl,
      input.status,
      input.agentUserId,
      input.userId,
      MODEL_ROLE
    ]
  );
  return result.affectedRows > 0;
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
  /** profile_audit_status=0 待提交，与用户端注册一致；须走提审→后台审核，不因后管创建而直通 */
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO users (
       user_no, openid, unionid, phone, role, phone_verified,
       nickname, avatar_url, verified_status, profile_audit_status, status, agent_user_id
     ) VALUES (?, ?, NULL, ?, ?, 1, ?, ?, 0, 0, ?, ?)`,
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
