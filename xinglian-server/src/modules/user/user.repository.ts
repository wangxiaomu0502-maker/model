import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import type { ContractKind } from "../admin/contract-templates.types";

function isUnknownColumnError(err: unknown): boolean {
  let cur: unknown = err;
  for (let d = 0; d < 6 && cur; d++) {
    const e = cur as {
      code?: string;
      errno?: number;
      sqlMessage?: string;
      cause?: unknown;
    };
    const code = String(e.code || "").toUpperCase();
    if (code === "ER_BAD_FIELD_ERROR" || Number(e.errno) === 1054) {
      return true;
    }
    if (/unknown column/i.test(String(e.sqlMessage || ""))) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

type UserProfileRow = RowDataPacket & {
  id: number;
  user_no: string;
  referrer_id?: number | null;
  openid: string;
  role: number;
  phone: string | null;
  real_name?: string | null;
  nickname: string | null;
  avatar_url: string | null;
  verified_status: number;
  profile_audit_status: number;
  profile_audit_reject_reason?: string | null;
  contract_platform_broker_signed_at?: Date | string | null;
  contract_platform_merchant_signed_at?: Date | string | null;
  contract_broker_model_signed_at?: Date | string | null;
  contract_platform_broker_signature_url?: string | null;
  contract_platform_merchant_signature_url?: string | null;
  contract_broker_model_signature_url?: string | null;
};

function normalizeProfileRow(row: UserProfileRow): UserProfileRow {
  return {
    ...row,
    contract_platform_broker_signed_at:
      row.contract_platform_broker_signed_at ?? null,
    contract_platform_merchant_signed_at:
      row.contract_platform_merchant_signed_at ?? null,
    contract_broker_model_signed_at:
      row.contract_broker_model_signed_at ?? null
  };
}

export async function findUserProfileById(
  userId: number
): Promise<UserProfileRow | null> {
  const [rows] = await dbPool.query<UserProfileRow[]>(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const row = rows[0];
  return row ? normalizeProfileRow(row) : null;
}

export async function updateUserContractSignedAt(
  userId: number,
  kind: ContractKind,
  signatureUrl: string
): Promise<boolean> {
  let sql: string;
  switch (kind) {
    case "platform_broker":
      sql =
        "UPDATE users SET contract_platform_broker_signed_at = CURRENT_TIMESTAMP, contract_platform_broker_signature_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
      break;
    case "platform_merchant":
      sql =
        "UPDATE users SET contract_platform_merchant_signed_at = CURRENT_TIMESTAMP, contract_platform_merchant_signature_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
      break;
    case "broker_model":
      sql =
        "UPDATE users SET contract_broker_model_signed_at = CURRENT_TIMESTAMP, contract_broker_model_signature_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
      break;
    default:
      return false;
  }
  try {
    const [result] = await dbPool.query<ResultSetHeader>(sql, [signatureUrl, userId]);
    return result.affectedRows > 0;
  } catch (err) {
    if (isUnknownColumnError(err)) {
      throw new AppError(
        "数据库缺少合同签署/签名字段，请执行 sql/alter-users-contract-signed-at.sql 与 sql/alter-users-contract-signature-url.sql",
        503,
        ErrorCodes.UPSTREAM_ERROR
      );
    }
    throw err;
  }
}

export async function updateUserAvatarUrl(
  userId: number,
  avatarUrl: string
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    "UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [avatarUrl, userId]
  );
  return result.affectedRows > 0;
}

export type BrokerPublicRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  real_name: string | null;
};

/** 按对外 user_no 查找正常状态的经纪人 users.id */
export async function findActiveBrokerIdByUserNo(userNo: string): Promise<number | null> {
  const key = String(userNo || "").trim();
  if (!key) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id FROM users
     WHERE user_no = ?
       AND role = 3
       AND status = 1
       AND deleted_at IS NULL
     LIMIT 1`,
    [key]
  );
  const id = rows[0]?.id;
  return id != null ? Number(id) : null;
}

export async function findBrokerPublicDisplayById(
  brokerUserId: number
): Promise<BrokerPublicRow | null> {
  const [rows] = await dbPool.query<BrokerPublicRow[]>(
    `SELECT u.id, u.user_no, u.nickname, bp.real_name
     FROM users u
     LEFT JOIN broker_profiles bp ON bp.user_id = u.id
     WHERE u.id = ?
       AND u.role = 3
       AND u.status = 1
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [brokerUserId]
  );
  return rows[0] ?? null;
}

/** 仅商家可绑定经纪人（referrer_id → role=3） */
export async function updateReferrerIdForMerchant(
  userId: number,
  referrerId: number | null
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET referrer_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND role = 2
       AND deleted_at IS NULL`,
    [referrerId, userId]
  );
  return result.affectedRows > 0;
}

export type AgentPublicRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  real_name: string | null;
};

export async function findActiveAgentIdByUserNo(userNo: string): Promise<number | null> {
  const key = String(userNo || "").trim();
  if (!key) return null;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id FROM users
     WHERE user_no = ?
       AND role = 4
       AND status = 1
       AND deleted_at IS NULL
     LIMIT 1`,
    [key]
  );
  const id = rows[0]?.id;
  return id != null ? Number(id) : null;
}

export async function findAgentPublicDisplayById(agentUserId: number): Promise<AgentPublicRow | null> {
  const [rows] = await dbPool.query<AgentPublicRow[]>(
    `SELECT u.id, u.user_no, u.nickname, ap.real_name
     FROM users u
     LEFT JOIN agent_profiles ap ON ap.user_id = u.id
     WHERE u.id = ?
       AND u.role = 4
       AND u.status = 1
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [agentUserId]
  );
  return rows[0] ?? null;
}

/** 解析订单完成时的经纪人：商户 referrer_id 须为 role=3 */
export async function resolveBrokerUserIdForMerchant(
  merchantUserId: number
): Promise<number | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT u.referrer_id AS rid, b.id AS bid
     FROM users u
     LEFT JOIN users b ON b.id = u.referrer_id AND b.role = 3 AND b.deleted_at IS NULL AND b.status = 1
     WHERE u.id = ? AND u.role = 2 AND u.deleted_at IS NULL
     LIMIT 1`,
    [merchantUserId]
  );
  const bid = rows[0]?.bid;
  return bid != null ? Number(bid) : null;
}

/** 解析订单完成时的代理人：模特 agent_user_id 须为 role=4 */
export async function resolveAgentUserIdForModel(modelUserId: number): Promise<number | null> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT u.agent_user_id AS aid, a.id AS valid_id
     FROM users u
     LEFT JOIN users a ON a.id = u.agent_user_id AND a.role = 4 AND a.deleted_at IS NULL AND a.status = 1
     WHERE u.id = ? AND u.role = 1 AND u.deleted_at IS NULL
     LIMIT 1`,
    [modelUserId]
  );
  const valid = rows[0]?.valid_id;
  return valid != null ? Number(valid) : null;
}
