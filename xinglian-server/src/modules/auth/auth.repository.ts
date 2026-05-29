import { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomBytes } from "node:crypto";

import { dbPool } from "../../config/db";
import type { ContractKind } from "../admin/contract-templates.types";
import { ExistingUserRow, LoginUserRow, PlatformBindModelRow } from "./auth.types";

const MODEL_ROLE = 1;

function unboundAccountOpenid(userId: number, role: number): string {
  return `orphan:role${role}:${userId}:${randomBytes(16).toString("hex")}`;
}

export async function findUserByOpenid(
  openid: string
): Promise<ExistingUserRow[]> {
  const [rows] = await dbPool.query<ExistingUserRow[]>(
    "SELECT id, openid FROM users WHERE openid = ? LIMIT 1",
    [openid]
  );
  return rows;
}

export async function createVisitorUser(
  userNo: string,
  openid: string,
  unionid: string | null
): Promise<void> {
  await dbPool.query(
    `INSERT INTO users
      (user_no, openid, unionid, phone, role, phone_verified, profile_audit_status, status)
     VALUES (?, ?, ?, NULL, 0, 0, 0, 1)`,
    [userNo, openid, unionid]
  );
}

export async function updateUnionid(
  openid: string,
  unionid: string | null
): Promise<void> {
  await dbPool.query(
    "UPDATE users SET unionid = COALESCE(?, unionid), updated_at = CURRENT_TIMESTAMP WHERE openid = ?",
    [unionid, openid]
  );
}

export async function findUnionidByUserId(userId: number): Promise<string | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT unionid FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId]
  );
  const unionid = rows[0]?.unionid;
  return unionid != null ? String(unionid) : null;
}

export async function findOpenidByUserId(userId: number): Promise<string | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT openid FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId]
  );
  const openid = rows[0]?.openid;
  return openid ? String(openid) : null;
}

export async function findLoginUserByOpenid(
  openid: string
): Promise<LoginUserRow[]> {
  const [rows] = await dbPool.query<LoginUserRow[]>(
    "SELECT id, user_no, openid, role FROM users WHERE openid = ? LIMIT 1",
    [openid]
  );
  return rows;
}

export async function findModelUserByPhoneForPlatformBind(
  phone: string
): Promise<PlatformBindModelRow[]> {
  const [rows] = await dbPool.query<PlatformBindModelRow[]>(
    `SELECT u.id, u.user_no, u.openid, u.role, u.unionid
     FROM users u
     LEFT JOIN model_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.phone = ?
       AND u.role = ?
       AND (
         u.status = 1
         OR (u.status = 4 AND mp.is_admin_created = 1)
       )
     LIMIT 1`,
    [phone, MODEL_ROLE]
  );
  return rows;
}

/** 将当前游客微信 openid 绑定到后台已预置的模特账号，并释放游客占位 openid */
export async function transferVisitorOpenidToPlatformUser(input: {
  visitorUserId: number;
  visitorOpenid: string;
  visitorUnionid: string | null;
  platformUserId: number;
  phone: string;
}): Promise<void> {
  const connection = await dbPool.getConnection();
  const releasedOpenid = `released:${input.visitorUserId}:${Date.now()}`;
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE users SET openid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND openid = ?",
      [releasedOpenid, input.visitorUserId, input.visitorOpenid]
    );
    await connection.query(
      `UPDATE users
       SET openid = ?,
           unionid = COALESCE(?, unionid),
           phone = ?,
           phone_verified = 1,
           status = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        input.visitorOpenid,
        input.visitorUnionid,
        input.phone,
        input.platformUserId
      ]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function bindPhoneByUserId(
  userId: number,
  phoneNumber: string
): Promise<void> {
  await dbPool.query(
    "UPDATE users SET phone = ?, phone_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [phoneNumber, userId]
  );
}

/** 注册收尾：实名/人脸仅写入 verified_status；资料审核 profile_audit_status 由后台另行流转（与人脸无关）。 */
export async function completeRegistrationByUserId(
  userId: number,
  role: number,
  phone: string,
  profile: {
    nickname: string;
    avatarUrl: string;
    realName: string;
    idCardNo: string;
    idCardFrontUrl: string;
    idCardBackUrl: string;
    idCardIssueAuthority: string;
    idCardValidDate: string;
  },
  referrerBrokerUserId: number | null = null
): Promise<void> {
  await dbPool.query(
    `UPDATE users
     SET role = ?,
         phone = ?,
         phone_verified = 1,
         nickname = ?,
         avatar_url = ?,
         real_name = ?,
         id_card_no = ?,
         id_card_front_url = ?,
         id_card_back_url = ?,
         id_card_issue_authority = ?,
         id_card_valid_date = ?,
         verified_status = 2,
         profile_audit_status = 0,
         referrer_id = IF(? IS NOT NULL, COALESCE(referrer_id, ?), referrer_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      role,
      phone,
      profile.nickname,
      profile.avatarUrl,
      profile.realName,
      profile.idCardNo,
      profile.idCardFrontUrl,
      profile.idCardBackUrl,
      profile.idCardIssueAuthority,
      profile.idCardValidDate,
      referrerBrokerUserId,
      referrerBrokerUserId,
      userId
    ]
  );
}

/** 注册前换身份时，清除其它类型的预签署记录（仅游客 role=0） */
export async function clearOtherRegistrationContracts(
  userId: number,
  keepKind: ContractKind
): Promise<void> {
  const parts: string[] = [];
  const addClear = (kind: ContractKind, signedCol: string, urlCol: string) => {
    if (kind === keepKind) return;
    parts.push(`${signedCol} = NULL`, `${urlCol} = NULL`);
  };
  addClear(
    "platform_broker",
    "contract_platform_broker_signed_at",
    "contract_platform_broker_signature_url"
  );
  addClear(
    "platform_merchant",
    "contract_platform_merchant_signed_at",
    "contract_platform_merchant_signature_url"
  );
  addClear("broker_model", "contract_broker_model_signed_at", "contract_broker_model_signature_url");
  if (parts.length === 0) return;
  await dbPool.query(
    `UPDATE users SET ${parts.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 0`,
    [userId]
  );
}

/** 推广扫码登录：游客或未绑定客户的 referrer_id 仅写入一次 */
export async function bindReferrerIfUnsetForPromo(
  userId: number,
  referrerBrokerUserId: number
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET referrer_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND referrer_id IS NULL
       AND deleted_at IS NULL
       AND role IN (0, 2)`,
    [referrerBrokerUserId, userId]
  );
  return (result.affectedRows ?? 0) > 0;
}

export async function upsertBrokerProfileOnRegistration(input: {
  userId: number;
  realName: string;
  isProfessional: boolean;
  brokerLicenseUrl: string | null;
}): Promise<void> {
  await dbPool.query(
    `INSERT INTO broker_profiles (user_id, real_name, is_professional, broker_license_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       real_name = VALUES(real_name),
       is_professional = VALUES(is_professional),
       broker_license_url = VALUES(broker_license_url),
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.userId,
      input.realName,
      input.isProfessional ? 1 : 0,
      input.brokerLicenseUrl
    ]
  );
}

export async function revertAccountToVisitorByUserIdAndOpenid(
  userId: number,
  openid: string
): Promise<boolean> {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    const [accountRows] = await connection.query<RowDataPacket[]>(
      `SELECT role
       FROM users
       WHERE id = ? AND openid = ? AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [userId, openid]
    );
    const account = accountRows[0];
    if (!account) {
      await connection.rollback();
      return false;
    }

    const role = Number(account.role ?? 0);
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE users
       SET openid = ?,
           unionid = NULL,
           status = 4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND openid = ?`,
      [unboundAccountOpenid(userId, role), userId, openid]
    );

    if (role === MODEL_ROLE) {
      await connection.query(
        `UPDATE model_profiles
         SET is_available = 0, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [userId]
      );
    }

    await connection.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
