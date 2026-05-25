import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type AdminUserListRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  role: number;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  profile_audit_reject_reason: string | null;
  is_wechat_bound: number | string | null;
  model_order_enabled: number | null;
  contract_broker_model_signed_at: Date | string | null;
  contract_broker_model_signature_url: string | null;
  contract_platform_merchant_signed_at: Date | string | null;
  contract_platform_broker_signed_at: Date | string | null;
  created_at: Date;
  updated_at: Date;
  referrer_broker_user_no: string | null;
  referrer_broker_nickname: string | null;
  referrer_broker_real_name: string | null;
  referrer_broker_user_id: number | null;
  agent_user_no: string | null;
  agent_nickname: string | null;
  agent_real_name: string | null;
  /** 作为转介绍经纪人时：referrer_id 指向本行的商家数（role=2） */
  bound_merchant_count?: number | string | null;
  broker_is_professional?: number | string | null;
  broker_license_url?: string | null;
  model_is_admin_created?: number | string | null;
};

export type AdminModelBasicDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  status: number;
  agent_user_id: number | null;
  agent_user_no: string | null;
  agent_nickname: string | null;
  agent_real_name: string | null;
  avatar_url: string | null;
  profile_audit_status: number;
  profile_audit_reject_reason: string | null;
  contract_broker_model_signed_at: Date | string | null;
  contract_broker_model_signature_url: string | null;
  phone: string | null;
  real_name: string | null;
  id_card_no: string | null;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
  id_card_issue_authority: string | null;
  id_card_valid_date: string | null;
  stage_name: string | null;
  gender: number | null;
  birth_date: Date | string | null;
  city: string | null;
  intro: string | null;
  height: number | null;
  weight: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  shoe_size: string | null;
  hair_color: string | null;
  skin_tone: string | null;
  price_hour: number | null;
  price_halfday: number | null;
  price_allday: number | null;
  is_available: number;
  only_local_orders: number;
  only_female_clients: number;
  is_admin_created: number | string | null;
  card_json: string | null;
  portfolio_json: string | null;
  style_position_json: string | null;
  schedule_json: string | null;
  order_settings_json: string | null;
};

export type AdminModelCategoryRow = RowDataPacket & {
  id: number;
  name: string;
  type: "main" | "style" | "scene";
};

/** 工作台等场景：一次查询 role 1/2/3/4 用户数（未删除） */
export async function countUsersGroupedByRole123(): Promise<{
  modelCount: number;
  merchantCount: number;
  brokerCount: number;
  agentCount: number;
}> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT role, COUNT(*) AS cnt
     FROM users
     WHERE deleted_at IS NULL AND role IN (1, 2, 3, 4)
     GROUP BY role`
  );
  const byRole = new Map<number, number>();
  for (const row of rows) {
    byRole.set(Number(row.role), Number(row.cnt ?? 0));
  }
  return {
    modelCount: byRole.get(1) ?? 0,
    merchantCount: byRole.get(2) ?? 0,
    brokerCount: byRole.get(3) ?? 0,
    agentCount: byRole.get(4) ?? 0
  };
}

export async function countUsersForAdminByRole(role: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE deleted_at IS NULL
       AND role = ?`,
    [role]
  );
  const cnt = rows[0]?.cnt;
  return Number(cnt ?? 0);
}

export async function findUsersPageForAdminByRole(
  role: number,
  offset: number,
  limit: number
): Promise<AdminUserListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminUserListRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.role, u.phone, u.status,
            u.verified_status, u.profile_audit_status, u.profile_audit_reject_reason,
            CASE
              WHEN u.openid IS NOT NULL
               AND u.openid <> ''
               AND u.openid NOT LIKE 'admin:%'
               AND u.openid NOT LIKE 'released:%'
               AND u.openid NOT LIKE 'orphan:%'
              THEN 1
              ELSE 0
            END AS is_wechat_bound,
            mp.is_available AS model_order_enabled,
            u.contract_broker_model_signed_at, u.contract_broker_model_signature_url,
            u.contract_platform_merchant_signed_at, u.contract_platform_broker_signed_at,
            u.created_at, u.updated_at,
            u.referrer_id AS referrer_broker_user_id,
            ref.user_no AS referrer_broker_user_no,
            ref.nickname AS referrer_broker_nickname,
            bref.real_name AS referrer_broker_real_name,
            ag.user_no AS agent_user_no,
            ag.nickname AS agent_nickname,
            ap.real_name AS agent_real_name,
            (SELECT COUNT(*) FROM users ub
             WHERE ub.deleted_at IS NULL AND ub.role = 2 AND ub.referrer_id = u.id) AS bound_merchant_count,
            bp_self.is_professional AS broker_is_professional,
            bp_self.broker_license_url AS broker_license_url,
            mp.is_admin_created AS model_is_admin_created
     FROM users u
     LEFT JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN broker_profiles bp_self ON bp_self.user_id = u.id
     LEFT JOIN users ref ON ref.id = u.referrer_id AND ref.deleted_at IS NULL AND ref.role = 3
     LEFT JOIN broker_profiles bref ON bref.user_id = ref.id
     LEFT JOIN users ag ON ag.id = u.agent_user_id AND ag.deleted_at IS NULL AND ag.role = 4
     LEFT JOIN agent_profiles ap ON ap.user_id = ag.id
     WHERE u.deleted_at IS NULL
       AND u.role = ?
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [role, safeLimit, safeOffset]
  );
  return rows;
}

export async function findModelBasicDetailForAdminByUserId(
  userId: number
): Promise<AdminModelBasicDetailRow | null> {
  const [rows] = await dbPool.query<AdminModelBasicDetailRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.status, u.agent_user_id, u.avatar_url, u.phone,
            ag.user_no AS agent_user_no, ag.nickname AS agent_nickname,
            ap.real_name AS agent_real_name,
            u.profile_audit_status, u.profile_audit_reject_reason,
            u.contract_broker_model_signed_at, u.contract_broker_model_signature_url,
            u.real_name, u.id_card_no, u.id_card_front_url, u.id_card_back_url,
            u.id_card_issue_authority, u.id_card_valid_date,
            mp.stage_name, mp.gender, mp.birth_date, mp.city, mp.intro,
            mp.height, mp.weight, mp.bust, mp.waist, mp.hip,
            mp.shoe_size, mp.hair_color, mp.skin_tone,
            mp.price_hour, mp.price_halfday, mp.price_allday,
            mp.is_available, mp.only_local_orders, mp.only_female_clients,
            mp.is_admin_created,
            mex.card_json, mex.portfolio_json, mex.style_position_json, mex.schedule_json, mex.order_settings_json
     FROM users u
     LEFT JOIN users ag ON ag.id = u.agent_user_id AND ag.deleted_at IS NULL
     LEFT JOIN agent_profiles ap ON ap.user_id = ag.id
     LEFT JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN model_extra_data mex ON mex.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 1
       AND u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateModelAgentUserIdForAdmin(
  modelUserId: number,
  agentUserId: number | null
): Promise<boolean> {
  const id = Math.floor(Number(modelUserId));
  if (!Number.isFinite(id) || id <= 0) return false;
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET agent_user_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = 1 AND deleted_at IS NULL`,
    [agentUserId, id]
  );
  return result.affectedRows > 0;
}

export async function findValidAgentUserIdForAdmin(agentUserId: number): Promise<number | null> {
  const id = Math.floor(Number(agentUserId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id FROM users
     WHERE id = ? AND role = 4 AND status = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  const found = rows[0]?.id;
  return found != null ? Number(found) : null;
}

export async function updateMerchantReferrerIdForAdmin(
  merchantUserId: number,
  brokerUserId: number | null
): Promise<boolean> {
  const id = Math.floor(Number(merchantUserId));
  if (!Number.isFinite(id) || id <= 0) return false;
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET referrer_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = 2 AND deleted_at IS NULL`,
    [brokerUserId, id]
  );
  return result.affectedRows > 0;
}

export async function findValidBrokerUserIdForAdmin(brokerUserId: number): Promise<number | null> {
  const id = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id FROM users
     WHERE id = ?
       AND role = 3
       AND status = 1
       AND deleted_at IS NULL
       AND contract_platform_broker_signed_at IS NOT NULL
     LIMIT 1`,
    [id]
  );
  const found = rows[0]?.id;
  return found != null ? Number(found) : null;
}

export async function findModelCategoriesForAdminByUserId(
  userId: number
): Promise<AdminModelCategoryRow[]> {
  const [rows] = await dbPool.query<AdminModelCategoryRow[]>(
    `SELECT n.id, n.name, n.type
     FROM model_profile_categories pc
     INNER JOIN model_category_nodes n ON n.id = pc.category_id
     WHERE pc.user_id = ?
     ORDER BY n.type ASC, n.sort_order ASC, n.id ASC`,
    [userId]
  );
  return rows;
}

/** 后台商家详情：users + merchant_profiles + 转介绍经纪人 */
export type AdminMerchantBasicDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  role: number;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  profile_audit_reject_reason: string | null;
  contract_platform_merchant_signed_at: Date | string | null;
  contract_platform_merchant_signature_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  city: string | null;
  referrer_broker_user_no: string | null;
  referrer_broker_nickname: string | null;
  referrer_broker_real_name: string | null;
  referrer_broker_user_id: number | null;
};

export async function findMerchantBasicDetailForAdminByUserId(
  userId: number
): Promise<AdminMerchantBasicDetailRow | null> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<AdminMerchantBasicDetailRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.role, u.phone, u.status,
            u.verified_status, u.profile_audit_status, u.profile_audit_reject_reason,
            u.contract_platform_merchant_signed_at, u.contract_platform_merchant_signature_url,
            u.created_at, u.updated_at,
            mp.city,
            u.referrer_id AS referrer_broker_user_id,
            ref.user_no AS referrer_broker_user_no,
            ref.nickname AS referrer_broker_nickname,
            bref.real_name AS referrer_broker_real_name
     FROM users u
     LEFT JOIN merchant_profiles mp ON mp.user_id = u.id
     LEFT JOIN users ref ON ref.id = u.referrer_id AND ref.deleted_at IS NULL
     LEFT JOIN broker_profiles bref ON bref.user_id = ref.id
     WHERE u.deleted_at IS NULL
       AND u.role = 2
       AND u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/** 后台经纪人详情：users + broker_profiles + 转介绍上级经纪人 + 绑定数量 */
export type AdminBrokerBasicDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  role: number;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  profile_audit_reject_reason: string | null;
  contract_platform_broker_signed_at: Date | string | null;
  contract_platform_broker_signature_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  broker_real_name: string | null;
  broker_is_professional: number | string | null;
  broker_license_url: string | null;
  referrer_broker_user_no: string | null;
  referrer_broker_nickname: string | null;
  referrer_broker_real_name: string | null;
  bound_merchant_count: number | string | null;
};

export async function findBrokerBasicDetailForAdminByUserId(
  userId: number
): Promise<AdminBrokerBasicDetailRow | null> {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const [rows] = await dbPool.query<AdminBrokerBasicDetailRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.role, u.phone, u.status,
            u.verified_status, u.profile_audit_status, u.profile_audit_reject_reason,
            u.contract_platform_broker_signed_at, u.contract_platform_broker_signature_url,
            u.created_at, u.updated_at,
            bp.real_name AS broker_real_name,
            bp.is_professional AS broker_is_professional,
            bp.broker_license_url AS broker_license_url,
            ref.user_no AS referrer_broker_user_no,
            ref.nickname AS referrer_broker_nickname,
            bref.real_name AS referrer_broker_real_name,
            (SELECT COUNT(*) FROM users ub
             WHERE ub.deleted_at IS NULL AND ub.role = 2 AND ub.referrer_id = u.id) AS bound_merchant_count
     FROM users u
     LEFT JOIN broker_profiles bp ON bp.user_id = u.id
     LEFT JOIN users ref ON ref.id = u.referrer_id AND ref.deleted_at IS NULL
     LEFT JOIN broker_profiles bref ON bref.user_id = ref.id
     WHERE u.deleted_at IS NULL
       AND u.role = 3
       AND u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export type AdminBoundMerchantForBrokerRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  contract_platform_merchant_signed_at: Date | string | null;
  city: string | null;
  created_at: Date | string;
};

export async function countBoundMerchantsForBrokerAdmin(brokerUserId: number): Promise<number> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return 0;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users u
     WHERE u.deleted_at IS NULL AND u.role = 2 AND u.referrer_id = ?`,
    [bid]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findBoundMerchantsPageForBrokerAdmin(
  brokerUserId: number,
  offset: number,
  limit: number
): Promise<AdminBoundMerchantForBrokerRow[]> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const [rows] = await dbPool.query<AdminBoundMerchantForBrokerRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.phone, u.status,
            u.verified_status, u.profile_audit_status,
            u.contract_platform_merchant_signed_at,
            mp.city,
            u.created_at
     FROM users u
     LEFT JOIN merchant_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 2
       AND u.referrer_id = ?
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [bid, safeLimit, safeOffset]
  );
  return rows;
}

/** 后台审核模特资料：仅审核中(1) → 通过(2) 或 驳回(3) */
export async function applyModelProfileAuditDecision(
  userId: number,
  decision: "approve" | "reject",
  rejectReason: string | null
): Promise<boolean> {
  if (decision === "approve") {
    const [result] = await dbPool.query<ResultSetHeader>(
      `UPDATE users
       SET profile_audit_status = 2,
           profile_audit_reject_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND role = 1 AND profile_audit_status = 1`,
      [userId]
    );
    return result.affectedRows > 0;
  }
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET profile_audit_status = 3,
         profile_audit_reject_reason = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = 1 AND profile_audit_status = 1`,
    [rejectReason, userId]
  );
  return result.affectedRows > 0;
}

export async function findUserRoleByIdForAdmin(userId: number): Promise<number | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  return Number(rows[0].role);
}
