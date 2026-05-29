import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import { findContractTemplateByKind } from "../admin/contract-templates.repository";
import type { ContractKind } from "../admin/contract-templates.types";
import {
  formatContractDateTimeCn,
  formatSqlDateTime,
  generateContractNo,
  renderContractHtml
} from "../contract/contract-render";

import {
  contractKindAllowedForRole,
  isUserContractSigned,
  type RegistrationTargetRole
} from "./user.contract-sign";
import {
  findAgentPublicDisplayById,
  findBrokerPublicDisplayById,
  findUserContractSnapshot,
  findUserProfileById,
  signUserContractWithSnapshot,
  updateModelRealnameVerified,
  updateUserNickname
} from "./user.repository";
import type { CompleteModelRealnameBody } from "./user.realname.types";
import { assertEidVerified } from "../eid/eid.service";

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

function contractPartiesLine(contractKind: ContractKind): string {
  switch (contractKind) {
    case "broker_model":
      return "平台和模特订立，由模特签署";
    case "platform_merchant":
      return "平台和客户订立，由客户签署";
    case "platform_broker":
      return "平台和经纪人订立，由经纪人签署";
    case "platform_agent":
      return "平台和代理人订立，由代理人签署";
    default:
      return "平台和用户订立，由用户签署";
  }
}

function pickUserContractSignedAt(user: Record<string, unknown>, contractKind: ContractKind): unknown {
  if (contractKind === "platform_broker") return user.contract_platform_broker_signed_at;
  if (contractKind === "platform_merchant") return user.contract_platform_merchant_signed_at;
  if (contractKind === "platform_agent") return user.contract_platform_agent_signed_at;
  return user.contract_broker_model_signed_at;
}

function pickUserContractSignatureUrl(user: Record<string, unknown>, contractKind: ContractKind): string | null {
  let value: unknown;
  if (contractKind === "platform_broker") value = user.contract_platform_broker_signature_url;
  else if (contractKind === "platform_merchant") value = user.contract_platform_merchant_signature_url;
  else if (contractKind === "platform_agent") value = user.contract_platform_agent_signature_url;
  else value = user.contract_broker_model_signature_url;
  const text = value == null ? "" : String(value).trim();
  return text || null;
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
  idCardNo: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardIssueAuthority: string | null;
  idCardValidDate: string | null;
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
    idCardNo: user.id_card_no != null ? String(user.id_card_no) : null,
    idCardFrontUrl: user.id_card_front_url != null ? String(user.id_card_front_url) : null,
    idCardBackUrl: user.id_card_back_url != null ? String(user.id_card_back_url) : null,
    idCardIssueAuthority:
      user.id_card_issue_authority != null ? String(user.id_card_issue_authority) : null,
    idCardValidDate: user.id_card_valid_date != null ? String(user.id_card_valid_date) : null,
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

export function isModelRealnameVerified(verifiedStatus: number): boolean {
  return Number(verifiedStatus) === 2;
}

/** 已绑定模特账号补做实名（后管预开号等），与用户端注册实名数据口径一致 */
export async function completeModelRealnameForCurrentUser(
  userId: number,
  body: CompleteModelRealnameBody
): Promise<{ verifiedStatus: number }> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(user.role) !== 1) {
    throw new AppError("仅模特可提交实名认证", 403, ErrorCodes.FORBIDDEN);
  }
  if (isModelRealnameVerified(user.verified_status)) {
    throw new AppError("已完成实名认证", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const rn = String(body.realName).trim();
  const idNo = String(body.idCardNo).trim();
  const front = String(body.idCardFrontUrl).trim();
  const back = String(body.idCardBackUrl).trim();
  const issue = String(body.idCardIssueAuthority).trim();
  const valid = String(body.idCardValidDate).trim();
  await assertEidVerified({
    userId,
    eidToken: body.eidToken,
    realName: rn,
    idCardNo: idNo
  });

  const ok = await updateModelRealnameVerified(userId, {
    realName: rn,
    idCardNo: idNo,
    idCardFrontUrl: front,
    idCardBackUrl: back,
    idCardIssueAuthority: issue,
    idCardValidDate: valid
  });
  if (!ok) {
    throw new AppError("实名认证提交失败，请稍后重试", 409, ErrorCodes.CONFLICT);
  }
  return { verifiedStatus: 2 };
}

export async function updateNicknameForCurrentUser(
  userId: number,
  nickname: string
): Promise<{ nickname: string }> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  const trimmed = String(nickname || "").trim();
  if (!trimmed) {
    throw new AppError("nickname is required", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (trimmed.length > 50) {
    throw new AppError("nickname too long", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const ok = await updateUserNickname(userId, trimmed);
  if (!ok) {
    throw new AppError("failed to update nickname", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return { nickname: trimmed };
}

function signedAtIsoForKind(
  profile: CurrentUserProfileDto,
  contractKind: ContractKind
): string {
  if (contractKind === "platform_broker") {
    return profile.contractPlatformBrokerSignedAt ?? new Date().toISOString();
  }
  if (contractKind === "platform_merchant") {
    return profile.contractPlatformMerchantSignedAt ?? new Date().toISOString();
  }
  if (contractKind === "platform_agent") {
    return profile.contractPlatformAgentSignedAt ?? new Date().toISOString();
  }
  return profile.contractBrokerModelSignedAt ?? new Date().toISOString();
}

export async function signContractForUserId(
  userId: number,
  contractKind: ContractKind,
  signatureUrl: string,
  options?: { enforceRoleMatch?: boolean }
): Promise<string> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }

  if (options?.enforceRoleMatch !== false) {
    const allowed = contractKindAllowedForRole(Number(user.role));
    if (!allowed || allowed !== contractKind) {
      throw new AppError("contract kind not allowed for this role", 403, ErrorCodes.FORBIDDEN);
    }
  }

  if (!signatureUrl || !String(signatureUrl).trim()) {
    throw new AppError("signature url is required", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const template = await findContractTemplateByKind(contractKind);
  if (!template) {
    throw new AppError("合同模板不存在", 404, ErrorCodes.NOT_FOUND);
  }

  const signedAt = new Date();
  const contractNo = generateContractNo({
    contractKind,
    userNo: user.user_no,
    signedAt
  });
  const contentHtml = renderContractHtml(template.content_html, {
    contractNo,
    signedAt
  });
  const ok = await signUserContractWithSnapshot({
    userId,
    kind: contractKind,
    contractNo,
    title: template.title,
    contentHtml,
    signatureUrl: String(signatureUrl).trim(),
    templateUpdatedAt: template.updated_at,
    signedAtSql: formatSqlDateTime(signedAt)
  });
  if (!ok) {
    throw new AppError("failed to sign contract", 500, ErrorCodes.INTERNAL_ERROR);
  }

  const refreshed = await getCurrentUserProfile(userId);
  return signedAtIsoForKind(refreshed, contractKind);
}

export async function signContractForCurrentUser(
  userId: number,
  contractKind: ContractKind,
  signatureUrl: string
): Promise<string> {
  return signContractForUserId(userId, contractKind, signatureUrl, { enforceRoleMatch: true });
}

export function assertRegistrationContractSigned(
  user: Record<string, unknown>,
  targetRole: RegistrationTargetRole
): void {
  const kind = contractKindAllowedForRole(targetRole);
  if (!kind) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (!isUserContractSigned(user, kind)) {
    throw new AppError("请先阅读并签署协议后再完成注册", 400, ErrorCodes.VALIDATION_ERROR);
  }
}

export async function getMyContractForCurrentUser(
  userId: number,
  contractKind: ContractKind,
  options?: { enforceRoleMatch?: boolean }
): Promise<{
  contractKind: ContractKind;
  title: string;
  contentHtml: string;
  partiesLine: string;
  contractNo: string;
  signedAt: string | null;
  signedAtDisplay: string;
  signatureUrl: string | null;
  isSnapshot: boolean;
}> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (options?.enforceRoleMatch !== false) {
    const allowed = contractKindAllowedForRole(Number(user.role));
    if (!allowed || allowed !== contractKind) {
      throw new AppError("contract kind not allowed for this role", 403, ErrorCodes.FORBIDDEN);
    }
  }
  const snapshot = await findUserContractSnapshot(userId, contractKind);
  if (snapshot) {
    const signedIso = dateFieldToIso(snapshot.signed_at) ?? null;
    const signedDate = signedIso ? new Date(signedIso) : new Date(snapshot.signed_at);
    const signedAtDisplay = Number.isNaN(signedDate.getTime())
      ? String(snapshot.signed_at)
      : formatContractDateTimeCn(signedDate);
    return {
      contractKind,
      title: snapshot.title,
      contentHtml: snapshot.content_html,
      partiesLine: contractPartiesLine(contractKind),
      contractNo: snapshot.contract_no,
      signedAt: signedIso,
      signedAtDisplay,
      signatureUrl: snapshot.signature_url || null,
      isSnapshot: true
    };
  }

  const template = await findContractTemplateByKind(contractKind);
  if (!template) {
    throw new AppError("合同模板不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const existingSignedIso = dateFieldToIso(pickUserContractSignedAt(user, contractKind));
  const existingSignedDate = existingSignedIso ? new Date(existingSignedIso) : null;
  const previewAt =
    existingSignedDate && !Number.isNaN(existingSignedDate.getTime())
      ? existingSignedDate
      : new Date();
  const contractNo = generateContractNo({
    contractKind,
    userNo: user.user_no,
    signedAt: previewAt
  });
  return {
    contractKind,
    title: template.title,
    contentHtml: renderContractHtml(template.content_html, {
      contractNo,
      signedAt: previewAt
    }),
    partiesLine: contractPartiesLine(contractKind),
    contractNo,
    signedAt: existingSignedIso,
    signedAtDisplay: formatContractDateTimeCn(previewAt),
    signatureUrl: pickUserContractSignatureUrl(user, contractKind),
    isSnapshot: false
  };
}
