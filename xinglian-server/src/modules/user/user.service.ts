import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import type { ContractKind } from "../admin/contract-templates.types";

import { contractKindAllowedForRole } from "./user.contract-sign";
import {
  findAgentPublicDisplayById,
  findBrokerPublicDisplayById,
  findUserProfileById,
  updateUserContractSignedAt
} from "./user.repository";

function dateFieldToIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  // MySQL 等常见的「YYYY-MM-DD HH:mm:ss」，避免把原始串下发给 iOS（WKWebView 解析失败）
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      m[4] !== undefined ? Number(m[4]) : 0,
      m[5] !== undefined ? Number(m[5]) : 0,
      m[6] !== undefined ? Number(m[6]) : 0
    );
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export type CurrentUserProfileDto = {
  id: number;
  userNo: string;
  openid: string;
  role: number;
  phone: string | null;
  realName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  verifiedStatus: number;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  contractPlatformBrokerSignedAt: string | null;
  contractPlatformMerchantSignedAt: string | null;
  contractBrokerModelSignedAt: string | null;
  contractPlatformAgentSignedAt: string | null;
  contractPlatformBrokerSignatureUrl: string | null;
  contractPlatformMerchantSignatureUrl: string | null;
  contractBrokerModelSignatureUrl: string | null;
  contractPlatformAgentSignatureUrl: string | null;
  /** 商家绑定的经纪人（referrer_id → role=3） */
  referrerBroker: {
    userId: number;
    userNo: string;
    nickname: string | null;
    realName: string | null;
    displayName: string;
  } | null;
  /** 模特所属代理人（agent_user_id → role=4） */
  agentUser: {
    userId: number;
    userNo: string;
    nickname: string | null;
    realName: string | null;
    displayName: string;
  } | null;
};

function brokerDisplayName(row: {
  real_name: string | null;
  nickname: string | null;
  user_no: string;
}): string {
  const rn = row.real_name != null ? String(row.real_name).trim() : "";
  if (rn) return rn;
  const nn = row.nickname != null ? String(row.nickname).trim() : "";
  if (nn) return nn;
  return String(row.user_no || "").trim() || "经纪人";
}

export function isMerchantPlatformContractSigned(user: {
  contract_platform_merchant_signed_at?: Date | string | null;
}): boolean {
  const at = user.contract_platform_merchant_signed_at;
  return at != null && String(at).trim() !== "";
}

export function assertMerchantPlatformContractSigned(user: {
  contract_platform_merchant_signed_at?: Date | string | null;
}): void {
  if (!isMerchantPlatformContractSigned(user)) {
    throw new AppError(
      "请先签署「平台与商家服务合同」后再预约下单",
      400,
      ErrorCodes.VALIDATION_ERROR
    );
  }
}

function agentDisplayName(row: {
  real_name: string | null;
  nickname: string | null;
  user_no: string;
}): string {
  const rn = row.real_name != null ? String(row.real_name).trim() : "";
  if (rn) return rn;
  const nn = row.nickname != null ? String(row.nickname).trim() : "";
  if (nn) return nn;
  return String(row.user_no || "").trim() || "代理人";
}

export async function getCurrentUserProfile(userId: number): Promise<CurrentUserProfileDto> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }

  const role = Number(user.role);
  const refIdRaw = user.referrer_id;
  const refId =
    refIdRaw != null && Number.isFinite(Number(refIdRaw)) ? Number(refIdRaw) : null;
  const refRow =
    role === 2 && refId != null && refId > 0 ? await findBrokerPublicDisplayById(refId) : null;

  const agentIdRaw = (user as { agent_user_id?: number | null }).agent_user_id;
  const agentId =
    agentIdRaw != null && Number.isFinite(Number(agentIdRaw)) ? Number(agentIdRaw) : null;
  const agentRow =
    role === 1 && agentId != null && agentId > 0
      ? await findAgentPublicDisplayById(agentId)
      : null;

  return {
    id: user.id,
    userNo: user.user_no,
    openid: user.openid,
    role: user.role,
    phone: user.phone,
    realName: user.real_name ?? null,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    verifiedStatus: user.verified_status,
    profileAuditStatus: user.profile_audit_status,
    profileAuditRejectReason:
      user.profile_audit_reject_reason != null && String(user.profile_audit_reject_reason).trim()
        ? String(user.profile_audit_reject_reason)
        : null,
    contractPlatformBrokerSignedAt: dateFieldToIso(user.contract_platform_broker_signed_at),
    contractPlatformMerchantSignedAt: dateFieldToIso(user.contract_platform_merchant_signed_at),
    contractBrokerModelSignedAt: dateFieldToIso(user.contract_broker_model_signed_at),
    contractPlatformAgentSignedAt: dateFieldToIso(user.contract_platform_agent_signed_at),
    contractPlatformBrokerSignatureUrl: user.contract_platform_broker_signature_url ?? null,
    contractPlatformMerchantSignatureUrl: user.contract_platform_merchant_signature_url ?? null,
    contractBrokerModelSignatureUrl: user.contract_broker_model_signature_url ?? null,
    contractPlatformAgentSignatureUrl: user.contract_platform_agent_signature_url ?? null,
    referrerBroker: refRow
      ? {
          userId: refRow.id,
          userNo: String(refRow.user_no),
          nickname: refRow.nickname ?? null,
          realName: refRow.real_name ?? null,
          displayName: brokerDisplayName(refRow)
        }
      : null,
    agentUser: agentRow
      ? {
          userId: agentRow.id,
          userNo: String(agentRow.user_no),
          nickname: agentRow.nickname ?? null,
          realName: agentRow.real_name ?? null,
          displayName: agentDisplayName(agentRow)
        }
      : null
  };
}

export async function signContractForCurrentUser(
  userId: number,
  contractKind: ContractKind,
  signatureUrl: string
): Promise<string> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }

  const allowed = contractKindAllowedForRole(Number(user.role));
  if (!allowed || allowed !== contractKind) {
    throw new AppError("contract kind not allowed for this role", 403, ErrorCodes.FORBIDDEN);
  }

  if (!signatureUrl || !String(signatureUrl).trim()) {
    throw new AppError("signature url is required", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const ok = await updateUserContractSignedAt(userId, contractKind, String(signatureUrl).trim());
  if (!ok) {
    throw new AppError("failed to sign contract", 500, ErrorCodes.INTERNAL_ERROR);
  }

  const refreshed = await getCurrentUserProfile(userId);
  if (contractKind === "platform_broker") {
    return refreshed.contractPlatformBrokerSignedAt ?? new Date().toISOString();
  }
  if (contractKind === "platform_merchant") {
    return refreshed.contractPlatformMerchantSignedAt ?? new Date().toISOString();
  }
  if (contractKind === "platform_agent") {
    return refreshed.contractPlatformAgentSignedAt ?? new Date().toISOString();
  }
  return refreshed.contractBrokerModelSignedAt ?? new Date().toISOString();
}
