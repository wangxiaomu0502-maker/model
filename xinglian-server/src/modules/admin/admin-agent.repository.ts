import { randomBytes } from "crypto";

import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const AGENT_ROLE = 4;

export type AdminAgentListRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  real_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  city: string | null;
  business_license_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  bound_model_count: number | string | null;
  contract_platform_agent_signed_at: Date | string | null;
};

export type AdminAgentDetailRow = AdminAgentListRow;

const AGENT_SELECT = `
  u.id, u.user_no, u.nickname, u.avatar_url, u.phone, u.status,
  u.verified_status, u.real_name, u.contract_platform_agent_signed_at,
  ap.company_name, ap.contact_name, ap.emergency_contact_name, ap.emergency_contact_phone,
  ap.city, ap.business_license_url,
  u.created_at, u.updated_at,
  (SELECT COUNT(*) FROM users m
   WHERE m.deleted_at IS NULL AND m.role = 1 AND m.agent_user_id = u.id) AS bound_model_count`;

function generateUserNo(length = 12): string {
  const bytes = randomBytes(length);
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += BASE62[bytes[i] % BASE62.length];
  }
  return value;
}

function adminCreatedOpenid(): string {
  return `admin:agent:${randomBytes(16).toString("hex")}`;
}

export async function allocateUniqueUserNo(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const userNo = generateUserNo(12);
    const [rows] = await dbPool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE user_no = ? LIMIT 1",
      [userNo]
    );
    if (!rows[0]) return userNo;
  }
  throw new Error("failed to allocate user_no");
}

export async function countAgentsForAdmin(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE deleted_at IS NULL AND role = ?`,
    [AGENT_ROLE]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findAgentsPageForAdmin(
  offset: number,
  limit: number
): Promise<AdminAgentListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminAgentListRow[]>(
    `SELECT ${AGENT_SELECT}
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE u.deleted_at IS NULL AND u.role = ?
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [AGENT_ROLE, safeLimit, safeOffset]
  );
  return rows;
}

export async function findAgentDetailForAdminByUserId(
  userId: number
): Promise<AdminAgentDetailRow | null> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<AdminAgentDetailRow[]>(
    `SELECT ${AGENT_SELECT}
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE u.deleted_at IS NULL AND u.role = ? AND u.id = ?
     LIMIT 1`,
    [AGENT_ROLE, id]
  );
  return rows[0] ?? null;
}

export async function findAgentByPhoneForAdmin(
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

export type AgentProfileInput = {
  companyName: string;
  contactName: string;
  contactPhone: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  city: string;
  businessLicenseUrl: string;
  status: number;
};

export async function insertAgentForAdmin(input: AgentProfileInput & {
  userNo: string;
  openid: string;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO users (
       user_no, openid, unionid, phone, role, phone_verified,
       nickname, real_name, verified_status, profile_audit_status, status
     ) VALUES (?, ?, NULL, ?, ?, 1, ?, ?, 0, 2, ?)`,
    [
      input.userNo,
      input.openid,
      input.contactPhone,
      AGENT_ROLE,
      input.companyName,
      input.contactName,
      input.status
    ]
  );
  const userId = Number(result.insertId);
  await upsertAgentProfile(userId, input);
  return userId;
}

async function upsertAgentProfile(userId: number, input: AgentProfileInput): Promise<void> {
  await dbPool.query(
    `INSERT INTO agent_profiles (
       user_id, company_name, contact_name, real_name, city,
       emergency_contact_name, emergency_contact_phone, business_license_url
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       company_name = VALUES(company_name),
       contact_name = VALUES(contact_name),
       real_name = VALUES(real_name),
       city = VALUES(city),
       emergency_contact_name = VALUES(emergency_contact_name),
       emergency_contact_phone = VALUES(emergency_contact_phone),
       business_license_url = VALUES(business_license_url),
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      input.companyName,
      input.contactName,
      input.contactName,
      input.city,
      input.emergencyContactName,
      input.emergencyContactPhone,
      input.businessLicenseUrl
    ]
  );
}

export async function updateAgentForAdmin(
  userId: number,
  patch: Partial<AgentProfileInput> & { nickname?: string }
): Promise<boolean> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return false;

  const existing = await findAgentDetailForAdminByUserId(id);
  if (!existing) return false;

  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  if (patch.nickname !== undefined) {
    sets.push("nickname = ?");
    params.push(patch.nickname);
  }
  if (patch.contactPhone !== undefined) {
    sets.push("phone = ?");
    params.push(patch.contactPhone);
  }
  if (patch.contactName !== undefined) {
    sets.push("real_name = ?");
    params.push(patch.contactName);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }

  if (sets.length > 0) {
    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id, AGENT_ROLE);
    await dbPool.query<ResultSetHeader>(
      `UPDATE users SET ${sets.join(", ")}
       WHERE id = ? AND role = ? AND deleted_at IS NULL`,
      params
    );
  }

  const profilePatch: Partial<AgentProfileInput> = {};
  if (patch.companyName !== undefined) profilePatch.companyName = patch.companyName;
  if (patch.contactName !== undefined) profilePatch.contactName = patch.contactName;
  if (patch.contactPhone !== undefined) profilePatch.contactPhone = patch.contactPhone;
  if (patch.emergencyContactName !== undefined) {
    profilePatch.emergencyContactName = patch.emergencyContactName;
  }
  if (patch.emergencyContactPhone !== undefined) {
    profilePatch.emergencyContactPhone = patch.emergencyContactPhone;
  }
  if (patch.city !== undefined) profilePatch.city = patch.city;
  if (patch.businessLicenseUrl !== undefined) {
    profilePatch.businessLicenseUrl = patch.businessLicenseUrl;
  }

  if (Object.keys(profilePatch).length > 0) {
    const merged: AgentProfileInput = {
      companyName:
        profilePatch.companyName ??
        (existing.company_name != null ? String(existing.company_name) : ""),
      contactName:
        profilePatch.contactName ??
        (existing.contact_name != null
          ? String(existing.contact_name)
          : existing.real_name != null
            ? String(existing.real_name)
            : ""),
      contactPhone:
        profilePatch.contactPhone ?? (existing.phone != null ? String(existing.phone) : ""),
      emergencyContactName:
        profilePatch.emergencyContactName !== undefined
          ? profilePatch.emergencyContactName
          : existing.emergency_contact_name != null
            ? String(existing.emergency_contact_name)
            : null,
      emergencyContactPhone:
        profilePatch.emergencyContactPhone !== undefined
          ? profilePatch.emergencyContactPhone
          : existing.emergency_contact_phone != null
            ? String(existing.emergency_contact_phone)
            : null,
      city: profilePatch.city ?? (existing.city != null ? String(existing.city) : ""),
      businessLicenseUrl:
        profilePatch.businessLicenseUrl ??
        (existing.business_license_url != null ? String(existing.business_license_url) : ""),
      status: patch.status ?? Number(existing.status ?? 2)
    };
    await upsertAgentProfile(id, merged);
  }

  return true;
}

export async function softDeleteAgentForAdmin(userId: number): Promise<boolean> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return false;
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET status = 4, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = ? AND deleted_at IS NULL`,
    [id, AGENT_ROLE]
  );
  return result.affectedRows > 0;
}

export async function clearModelsAgentBinding(agentUserId: number): Promise<void> {
  await dbPool.query(
    `UPDATE users SET agent_user_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE role = 1 AND agent_user_id = ? AND deleted_at IS NULL`,
    [agentUserId]
  );
}

export async function countModelsBoundToAgent(agentUserId: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE deleted_at IS NULL AND role = 1 AND agent_user_id = ?`,
    [agentUserId]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export type AdminBoundModelForAgentRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  contract_broker_model_signed_at: Date | string | null;
  model_order_enabled: number | null;
  city: string | null;
  created_at: Date | string;
};

export async function countBoundModelsForAgentAdmin(agentUserId: number): Promise<number> {
  const aid = Math.floor(Number(agentUserId));
  if (!Number.isFinite(aid) || aid <= 0) return 0;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users u
     WHERE u.deleted_at IS NULL AND u.role = 1 AND u.agent_user_id = ?`,
    [aid]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findBoundModelsPageForAgentAdmin(
  agentUserId: number,
  offset: number,
  limit: number
): Promise<AdminBoundModelForAgentRow[]> {
  const aid = Math.floor(Number(agentUserId));
  if (!Number.isFinite(aid) || aid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminBoundModelForAgentRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.phone, u.status,
            u.verified_status, u.profile_audit_status,
            u.contract_broker_model_signed_at,
            mp.is_available AS model_order_enabled,
            mp.city,
            u.created_at
     FROM users u
     LEFT JOIN model_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 1
       AND u.agent_user_id = ?
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [aid, safeLimit, safeOffset]
  );
  return rows;
}

function isMissingLedgerTable(err: unknown): boolean {
  const e = err as { errno?: number; code?: string };
  return e?.errno === 1146 || e?.code === "ER_NO_SUCH_TABLE";
}

export type AdminAgentLedgerRow = RowDataPacket & {
  id: number;
  amount: string | number;
  balance_after: string | number | null;
  biz_type: string;
  order_id: number | null;
  title: string | null;
  created_at: Date | string;
  order_no: string | null;
};

export async function countAgentLedgerForAdmin(agentUserId: number): Promise<number> {
  const aid = Math.floor(Number(agentUserId));
  if (!Number.isFinite(aid) || aid <= 0) return 0;
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM user_account_ledger WHERE user_id = ?`,
      [aid]
    );
    return Number(rows[0]?.cnt ?? 0);
  } catch (e) {
    if (isMissingLedgerTable(e)) return 0;
    throw e;
  }
}

export async function findAgentLedgerPageForAdmin(
  agentUserId: number,
  offset: number,
  limit: number
): Promise<AdminAgentLedgerRow[]> {
  const aid = Math.floor(Number(agentUserId));
  if (!Number.isFinite(aid) || aid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  try {
    const [rows] = await dbPool.query<AdminAgentLedgerRow[]>(
      `SELECT l.id, l.amount, l.balance_after, l.biz_type, l.order_id, l.title, l.created_at,
              o.order_no
       FROM user_account_ledger l
       LEFT JOIN orders o ON o.id = l.order_id
       WHERE l.user_id = ?
       ORDER BY l.id DESC
       LIMIT ? OFFSET ?`,
      [aid, safeLimit, safeOffset]
    );
    return rows;
  } catch (e) {
    if (isMissingLedgerTable(e)) return [];
    throw e;
  }
}

export async function sumAgentLedgerIncomeForAdmin(agentUserId: number): Promise<number> {
  const aid = Math.floor(Number(agentUserId));
  if (!Number.isFinite(aid) || aid <= 0) return 0;
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM user_account_ledger
       WHERE user_id = ? AND amount > 0`,
      [aid]
    );
    return Number(rows[0]?.total ?? 0);
  } catch (e) {
    if (isMissingLedgerTable(e)) return 0;
    throw e;
  }
}

export { adminCreatedOpenid };
