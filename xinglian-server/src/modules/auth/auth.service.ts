import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { env } from "../../config/env";
import {
  findActiveBrokerIdByUserNo,
  findUserProfileById
} from "../user/user.repository";
import {
  assertRegistrationContractSigned,
  getMyContractForCurrentUser,
  signContractForUserId
} from "../user/user.service";
import {
  contractKindAllowedForRole,
  isRegistrationTargetRole,
  type RegistrationTargetRole
} from "../user/user.contract-sign";
import {
  createVisitorUser,
  findLoginUserByOpenid,
  findUserByOpenid,
  findModelUserByPhoneForPlatformBind,
  findUnionidByUserId,
  bindPhoneByUserId,
  bindReferrerIfUnsetForPromo,
  clearOtherRegistrationContracts,
  completeRegistrationByUserId,
  upsertBrokerProfileOnRegistration,
  revertAccountToVisitorByUserIdAndOpenid,
  transferVisitorOpenidToPlatformUser,
  updateUnionid
} from "./auth.repository";
import { getWechatAccessToken } from "../../integrations/wechat/client";
import { assertEidVerified } from "../eid/eid.service";
import {
  identityRoleMap,
  PLATFORM_MODEL_BIND_FAIL_MESSAGE,
  WechatCode2SessionResponse,
  WechatPhoneResponse
} from "./auth.types";

const MODEL_ROLE = 1;

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROLE_MERCHANT = 2;
const ROLE_BROKER = 3;

function isDuplicatePhoneError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; sqlMessage?: string };
  const message = `${err.message || ""} ${err.sqlMessage || ""}`;
  return err.code === "ER_DUP_ENTRY" && message.includes("uk_users_phone");
}

function toDuplicatePhoneAppError(error: unknown): never {
  if (isDuplicatePhoneError(error)) {
    throw new AppError(
      "该手机号已被其他账号使用，请更换手机号或联系客服",
      409,
      ErrorCodes.CONFLICT
    );
  }
  throw error;
}

export function issueUserAccessToken(userId: number, openid: string, role: number): string {
  return jwt.sign(
    { userId, openid, role },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"]
    }
  );
}

function generateUserNo(length = 12): string {
  const bytes = randomBytes(length);
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += BASE62[bytes[i] % BASE62.length];
  }
  return value;
}

async function tryBindPromoBrokerOnLogin(userId: number, userRole: number, brokerUserNo?: string): Promise<void> {
  const role = Number(userRole);
  if (role !== 0 && role !== ROLE_MERCHANT) return;

  const brokerNo = String(brokerUserNo ?? "").trim();
  if (!brokerNo) return;

  const brokerId = await findActiveBrokerIdByUserNo(brokerNo);
  if (brokerId == null || brokerId === userId) return;

  await bindReferrerIfUnsetForPromo(userId, brokerId);
}

export async function loginByWechatCode(
  code: string,
  brokerUserNo?: string
): Promise<{
  user: { id: number; userNo: string; openid: string; role: number; verifiedStatus: number };
  token: string;
}> {
  const query = new URLSearchParams({
    appid: env.wechat.appId,
    secret: env.wechat.appSecret,
    js_code: code,
    grant_type: "authorization_code"
  });

  const response = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`,
    { method: "GET" }
  );
  const wechatResult = (await response.json()) as WechatCode2SessionResponse;

  if (!response.ok || !wechatResult.openid) {
    throw new AppError(
      `wechat code2session failed: ${wechatResult.errcode ?? ""} ${wechatResult.errmsg ?? ""}`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  const openid = wechatResult.openid;
  const unionid = wechatResult.unionid ?? null;

  const existingRows = await findUserByOpenid(openid);
  if (existingRows.length === 0) {
    let created = false;
    for (let retry = 0; retry < 5; retry += 1) {
      try {
        await createVisitorUser(generateUserNo(12), openid, unionid);
        created = true;
        break;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "ER_DUP_ENTRY") {
          throw error;
        }
      }
    }
    if (!created) {
      throw new AppError(
        "create user failed after retry",
        500,
        ErrorCodes.INTERNAL_ERROR
      );
    }
  } else {
    await updateUnionid(openid, unionid);
  }

  const rows = await findLoginUserByOpenid(openid);
  const user = rows[0];

  await tryBindPromoBrokerOnLogin(user.id, user.role, brokerUserNo);

  const token = issueUserAccessToken(user.id, user.openid, user.role);
  const prof = await findUserProfileById(user.id);

  return {
    user: {
      id: user.id,
      userNo: user.user_no,
      openid: user.openid,
      role: user.role,
      verifiedStatus: Number(prof?.verified_status ?? 0)
    },
    token
  };
}

async function fetchWechatPhoneNumber(code: string): Promise<string> {
  const accessToken = await getWechatAccessToken();
  const phoneResponse = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code })
    }
  );
  const phoneResult = (await phoneResponse.json()) as WechatPhoneResponse;
  const phoneNumber = phoneResult.phone_info?.phoneNumber?.trim();

  if (!phoneResponse.ok || !phoneNumber) {
    throw new AppError(
      `get phone number failed: ${phoneResult.errcode ?? ""} ${phoneResult.errmsg ?? ""}`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }
  return phoneNumber;
}

function isReassignablePlatformOpenid(openid: string): boolean {
  const o = String(openid || "").trim();
  return !o || o.startsWith("admin:") || o.startsWith("released:") || o.startsWith("orphan:");
}

export async function bindPhone(
  userId: number,
  code: string
): Promise<{ phone: string }> {
  const phoneNumber = await fetchWechatPhoneNumber(code);
  try {
    await bindPhoneByUserId(userId, phoneNumber);
  } catch (error) {
    toDuplicatePhoneAppError(error);
  }
  return { phone: phoneNumber };
}

/** 平台预绑定模特：授权手机号匹配后台模特账号后，将当前微信 openid 绑定到该账号 */
export async function bindPlatformModelByPhone(
  visitorUserId: number,
  visitorOpenid: string,
  phoneCode: string
): Promise<{
  user: { id: number; userNo: string; openid: string; role: number; verifiedStatus: number };
  token: string;
}> {
  const phone = await fetchWechatPhoneNumber(phoneCode);
  const platformRows = await findModelUserByPhoneForPlatformBind(phone);
  if (!platformRows.length || Number(platformRows[0].role) !== MODEL_ROLE) {
    throw new AppError(PLATFORM_MODEL_BIND_FAIL_MESSAGE, 404, ErrorCodes.NOT_FOUND);
  }

  const platform = platformRows[0];
  const platformOpenid = String(platform.openid || "").trim();

  if (platformOpenid === visitorOpenid) {
    const token = issueUserAccessToken(platform.id, platformOpenid, MODEL_ROLE);
    const prof = await findUserProfileById(platform.id);
    return {
      user: {
        id: platform.id,
        userNo: platform.user_no,
        openid: platformOpenid,
        role: MODEL_ROLE,
        verifiedStatus: Number(prof?.verified_status ?? 0)
      },
      token
    };
  }

  if (platformOpenid && !isReassignablePlatformOpenid(platformOpenid)) {
    throw new AppError(PLATFORM_MODEL_BIND_FAIL_MESSAGE, 409, ErrorCodes.CONFLICT);
  }

  if (platform.id !== visitorUserId) {
    const visitorUnionid = await findUnionidByUserId(visitorUserId);
    await transferVisitorOpenidToPlatformUser({
      visitorUserId,
      visitorOpenid,
      visitorUnionid,
      platformUserId: platform.id,
      phone
    });
  } else {
    try {
      await bindPhoneByUserId(visitorUserId, phone);
    } catch (error) {
      toDuplicatePhoneAppError(error);
    }
  }

  const loginRows = await findLoginUserByOpenid(visitorOpenid);
  const user = loginRows[0];
  if (!user || Number(user.role) !== MODEL_ROLE) {
    throw new AppError(PLATFORM_MODEL_BIND_FAIL_MESSAGE, 404, ErrorCodes.NOT_FOUND);
  }

  const token = issueUserAccessToken(user.id, user.openid, user.role);
  const prof = await findUserProfileById(user.id);
  return {
    user: {
      id: user.id,
      userNo: user.user_no,
      openid: user.openid,
      role: user.role,
      verifiedStatus: Number(prof?.verified_status ?? 0)
    },
    token
  };
}

function assertVisitorForRegistration(user: { role: number }): void {
  if (Number(user.role) !== 0) {
    throw new AppError("仅未完成注册的用户可签署注册协议", 403, ErrorCodes.FORBIDDEN);
  }
}

export async function getRegistrationContract(
  userId: number,
  targetRole: number
): Promise<Awaited<ReturnType<typeof getMyContractForCurrentUser>>> {
  if (!isRegistrationTargetRole(targetRole)) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  assertVisitorForRegistration(user);
  const kind = contractKindAllowedForRole(targetRole);
  if (!kind) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }
  return getMyContractForCurrentUser(userId, kind, { enforceRoleMatch: false });
}

export async function signRegistrationContract(
  userId: number,
  targetRole: number,
  signatureUrl: string
): Promise<{ contractKind: string; signedAt: string }> {
  if (!isRegistrationTargetRole(targetRole)) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  assertVisitorForRegistration(user);
  const kind = contractKindAllowedForRole(targetRole);
  if (!kind) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }
  await clearOtherRegistrationContracts(userId, kind);
  const signedAt = await signContractForUserId(userId, kind, signatureUrl, {
    enforceRoleMatch: false
  });
  return { contractKind: kind, signedAt };
}

/** 小程序实名注册：faceVerified 只校验实名流程；profile_audit_status 不归入人脸识别，默认待提交，平台后续单独审核。 */
export async function completeRegistration(input: {
  userId: number;
  role?: number;
  identity?: string;
  phone: string;
  faceVerified?: boolean;
  eidToken: string;
  nickname: string;
  avatarUrl: string;
  realName: string;
  idCardNo: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  idCardIssueAuthority: string;
  idCardValidDate: string;
  /** 推广链接中的经纪人 user_no，仅商家注册时尝试绑定 referrer_id */
  brokerUserNo?: string;
  isProfessional?: boolean;
  brokerLicenseUrl?: string;
}): Promise<{ role: number; verifiedStatus: number; profileAuditStatus: number }> {
  const {
    userId,
    role,
    identity,
    phone,
    faceVerified,
    eidToken,
    nickname,
    avatarUrl,
    realName,
    idCardNo,
    idCardFrontUrl,
    idCardBackUrl,
    idCardIssueAuthority,
    idCardValidDate,
    brokerUserNo,
    isProfessional,
    brokerLicenseUrl
  } = input;

  if (!faceVerified) {
    throw new AppError("face verification is required", 400, ErrorCodes.VALIDATION_ERROR);
  }

  let targetRole = Number(role || 0);
  if (!targetRole && identity) {
    targetRole = identityRoleMap[identity] || 0;
  }

  if (![1, 2, 3, 4].includes(targetRole)) {
    throw new AppError("unsupported role", 400, ErrorCodes.VALIDATION_ERROR);
  }

  let rn = String(realName ?? "").trim();
  let idNo = String(idCardNo ?? "").trim();
  let front = String(idCardFrontUrl ?? "").trim();
  let back = String(idCardBackUrl ?? "").trim();
  let issue = String(idCardIssueAuthority ?? "").trim();
  let valid = String(idCardValidDate ?? "").trim();

  if (!rn || !idNo || idNo.length < 15 || !front || !back || !issue || !valid) {
    throw new AppError("id card verification is required", 400, ErrorCodes.VALIDATION_ERROR);
  }
  await assertEidVerified({ userId, eidToken, realName: rn, idCardNo: idNo });

  let referrerBrokerUserId: number | null = null;
  if (targetRole === ROLE_MERCHANT) {
    const brokerNo = String(brokerUserNo ?? "").trim();
    if (brokerNo) {
      const brokerId = await findActiveBrokerIdByUserNo(brokerNo);
      if (brokerId != null && brokerId !== userId) {
        referrerBrokerUserId = brokerId;
      }
    }
  }

  if (targetRole === ROLE_BROKER) {
    const pro = Boolean(isProfessional);
    const license = String(brokerLicenseUrl ?? "").trim();
    if (!pro && license) {
      throw new AppError("part-time broker should not upload license", 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (pro && !license) {
      throw new AppError("professional broker license is required", 400, ErrorCodes.VALIDATION_ERROR);
    }
  }

  const visitor = await findUserProfileById(userId);
  if (!visitor) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(visitor.role) !== 0) {
    throw new AppError("account already registered", 409, ErrorCodes.CONFLICT);
  }
  assertRegistrationContractSigned(visitor, targetRole as RegistrationTargetRole);

  try {
    await completeRegistrationByUserId(
      userId,
      targetRole,
      phone,
      {
        nickname,
        avatarUrl,
        realName: rn,
        idCardNo: idNo,
        idCardFrontUrl: front,
        idCardBackUrl: back,
        idCardIssueAuthority: issue,
        idCardValidDate: valid
      },
      referrerBrokerUserId
    );
    if (targetRole === ROLE_BROKER) {
      await upsertBrokerProfileOnRegistration({
        userId,
        realName: rn,
        isProfessional: Boolean(isProfessional),
        brokerLicenseUrl: Boolean(isProfessional)
          ? String(brokerLicenseUrl ?? "").trim()
          : null
      });
    }
  } catch (error) {
    toDuplicatePhoneAppError(error);
  }
  return {
    role: targetRole,
    verifiedStatus: 2,
    profileAuditStatus: 0
  };
}

export async function deleteAccount(
  userId: number,
  openid: string
): Promise<{ reverted: boolean }> {
  const reverted = await revertAccountToVisitorByUserIdAndOpenid(userId, openid);
  return { reverted };
}
