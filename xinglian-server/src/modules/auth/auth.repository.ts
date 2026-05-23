import type { PoolConnection } from "mysql2/promise";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { ExistingUserRow, LoginUserRow } from "./auth.types";

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
         contract_platform_broker_signed_at = NULL,
         contract_platform_merchant_signed_at = NULL,
         contract_broker_model_signed_at = NULL,
         contract_platform_agent_signed_at = NULL,
         contract_platform_broker_signature_url = NULL,
         contract_platform_merchant_signature_url = NULL,
         contract_broker_model_signature_url = NULL,
         contract_platform_agent_signature_url = NULL,
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

async function deleteFromOptionalExtensionTable(
  connection: PoolConnection,
  sql: string,
  params: unknown[]
): Promise<void> {
  try {
    await connection.query(sql, params);
  } catch (err) {
    const code = String((err as { code?: string }).code || "");
    if (code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }
}

/** 注销退回游客：删除各角色扩展表行（不落订单等业务事实表）。 */
async function purgeUserPersonalExtensionRows(connection: PoolConnection, userId: number): Promise<void> {
  await connection.query("DELETE FROM model_profile_categories WHERE user_id = ?", [userId]);
  await connection.query("DELETE FROM model_extra_data WHERE user_id = ?", [userId]);
  await connection.query("DELETE FROM model_profiles WHERE user_id = ?", [userId]);
  await connection.query("DELETE FROM merchant_profiles WHERE user_id = ?", [userId]);
  await deleteFromOptionalExtensionTable(connection, "DELETE FROM broker_profiles WHERE user_id = ?", [userId]);
  await deleteFromOptionalExtensionTable(connection, "DELETE FROM agent_profiles WHERE user_id = ?", [userId]);
}

export async function revertAccountToVisitorByUserIdAndOpenid(
  userId: number,
  openid: string
): Promise<boolean> {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await purgeUserPersonalExtensionRows(connection, userId);

    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE users
       SET role = 0,
           phone = NULL,
           phone_verified = 0,
           nickname = NULL,
           avatar_url = NULL,
           gender = 0,
           real_name = NULL,
           id_card_no = NULL,
           id_card_front_url = NULL,
           id_card_back_url = NULL,
           id_card_issue_authority = NULL,
           id_card_valid_date = NULL,
           verified_status = 0,
           profile_audit_status = 0,
           profile_audit_reject_reason = NULL,
           contract_platform_broker_signed_at = NULL,
           contract_platform_merchant_signed_at = NULL,
           contract_broker_model_signed_at = NULL,
           contract_platform_agent_signed_at = NULL,
           contract_platform_broker_signature_url = NULL,
           contract_platform_merchant_signature_url = NULL,
           contract_broker_model_signature_url = NULL,
           contract_platform_agent_signature_url = NULL,
           referrer_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND openid = ?`,
      [userId, openid]
    );

    await connection.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
