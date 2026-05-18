import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { env } from "../../config/env";
import {
  createVisitorUser,
  findLoginUserByOpenid,
  findUserByOpenid,
  bindPhoneByUserId,
  completeRegistrationByUserId,
  revertAccountToVisitorByUserIdAndOpenid,
  updateUnionid
} from "./auth.repository";
import {
  identityRoleMap,
  WechatAccessTokenResponse,
  WechatCode2SessionResponse,
  WechatPhoneResponse
} from "./auth.types";

let cachedAccessToken = "";
let cachedAccessTokenExpireAt = 0;
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROLE_MERCHANT = 2;

/** 商家未做身份证 OCR 时入库占位（与小程序 app.js 提示文案一致） */
const MERCHANT_ID_OCR_PENDING = {
  realName: "待OCR核验",
  idCardNo: "000000000000000000",
  idCardFrontUrl: "cos:pending:id-card-front",
  idCardBackUrl: "cos:pending:id-card-back",
  issueAuthority: "待定",
  validDate: "待定"
} as const;

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

async function getWechatAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessTokenExpireAt) {
    return cachedAccessToken;
  }

  const query = new URLSearchParams({
    grant_type: "client_credential",
    appid: env.wechat.appId,
    secret: env.wechat.appSecret
  });

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?${query.toString()}`,
    { method: "GET" }
  );
  const result = (await response.json()) as WechatAccessTokenResponse;

  if (!response.ok || !result.access_token || !result.expires_in) {
    throw new AppError(
      `get wechat access_token failed: ${result.errcode ?? ""} ${result.errmsg ?? ""}`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  cachedAccessToken = result.access_token;
  cachedAccessTokenExpireAt = now + (result.expires_in - 300) * 1000;
  return cachedAccessToken;
}

export async function loginByWechatCode(code: string): Promise<{
  user: { id: number; userNo: string; openid: string; role: number };
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

  const token = issueUserAccessToken(user.id, user.openid, user.role);

  return {
    user: {
      id: user.id,
      userNo: user.user_no,
      openid: user.openid,
      role: user.role
    },
    token
  };
}

export async function bindPhone(
  userId: number,
  code: string
): Promise<{ phone: string }> {
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
  const phoneNumber = phoneResult.phone_info?.phoneNumber;

  if (!phoneResponse.ok || !phoneNumber) {
    throw new AppError(
      `get phone number failed: ${phoneResult.errcode ?? ""} ${phoneResult.errmsg ?? ""}`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  await bindPhoneByUserId(userId, phoneNumber);
  return { phone: phoneNumber };
}

/** 小程序实名注册：faceVerified 只校验实名流程；profile_audit_status 不归入人脸识别，默认待提交，平台后续单独审核。 */
export async function completeRegistration(input: {
  userId: number;
  role?: number;
  identity?: string;
  phone: string;
  faceVerified?: boolean;
  nickname: string;
  avatarUrl: string;
  realName: string;
  idCardNo: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  idCardIssueAuthority: string;
  idCardValidDate: string;
}): Promise<{ role: number; verifiedStatus: number; profileAuditStatus: number }> {
  const {
    userId,
    role,
    identity,
    phone,
    faceVerified,
    nickname,
    avatarUrl,
    realName,
    idCardNo,
    idCardFrontUrl,
    idCardBackUrl,
    idCardIssueAuthority,
    idCardValidDate
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

  if (targetRole === ROLE_MERCHANT) {
    if (!rn) rn = MERCHANT_ID_OCR_PENDING.realName;
    if (!idNo || idNo.length < 15) idNo = MERCHANT_ID_OCR_PENDING.idCardNo;
    if (!front) front = MERCHANT_ID_OCR_PENDING.idCardFrontUrl;
    if (!back) back = MERCHANT_ID_OCR_PENDING.idCardBackUrl;
    if (!issue) issue = MERCHANT_ID_OCR_PENDING.issueAuthority;
    if (!valid) valid = MERCHANT_ID_OCR_PENDING.validDate;
  }

  await completeRegistrationByUserId(userId, targetRole, phone, {
    nickname,
    avatarUrl,
    realName: rn,
    idCardNo: idNo,
    idCardFrontUrl: front,
    idCardBackUrl: back,
    idCardIssueAuthority: issue,
    idCardValidDate: valid
  });
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
