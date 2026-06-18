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
  const brief = await findUserBriefByPhoneForAdmin(phone, excludeUserId);
  return brief?.id ?? null;
}

export type AdminPhoneOwnerBrief = {
  id: number;
  userNo: string;
  role: number;
  verifiedStatus: number;
  profileAuditStatus: number;
};

export async function findUserBriefByPhoneForAdmin(
  phone: string,
  excludeUserId?: number
): Promise<AdminPhoneOwnerBrief | null> {
  const params: Array<string | number> = [phone];
  let sql = `SELECT id, user_no, role, verified_status, profile_audit_status
             FROM users
             WHERE deleted_at IS NULL AND phone = ?`;
  if (excludeUserId != null) {
    sql += " AND id <> ?";
    params.push(excludeUserId);
  }
  sql += " LIMIT 1";
  const [rows] = await dbPool.query<RowDataPacket[]>(sql, params);
  const row = rows[0];
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    userNo: String(row.user_no ?? ""),
    role: Number(row.role ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    profileAuditStatus: Number(row.profile_audit_status ?? 0)
  };
}

/** 未完成注册的游客账号可释放手机号，供后管创建模特复用 */
export async function clearIdleGuestPhoneForAdmin(userId: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET phone = NULL,
         phone_verified = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND deleted_at IS NULL
       AND role = 0
       AND verified_status = 0
       AND profile_audit_status = 0`,
    [userId]
  );
  return result.affectedRows > 0;
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
  /** profile_audit_status=0 待提交；verified_status=2 后管预开号默认已实名 */
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO users (
       user_no, openid, unionid, phone, role, phone_verified,
       nickname, avatar_url, verified_status, profile_audit_status, status, agent_user_id
     ) VALUES (?, ?, NULL, ?, ?, 1, ?, ?, 2, 0, ?, ?)`,
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
       user_id, is_admin_created, is_available, only_local_orders, only_female_clients, photos_disabled
     ) VALUES (?, 1, 0, 0, 0, 0)`,
    [userId]
  );
  await dbPool.query(`INSERT INTO model_extra_data (user_id) VALUES (?)`, [userId]);
  return userId;
}
