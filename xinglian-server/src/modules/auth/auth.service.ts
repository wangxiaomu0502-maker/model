import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { env } from "../../config/env";
import { findActiveBrokerIdByUserNo } from "../user/user.repository";
import {
  createVisitorUser,
  findLoginUserByOpenid,
  findUserByOpenid,
  bindPhoneByUserId,
  completeRegistrationByUserId,
  revertAccountToVisitorByUserIdAndOpenid,
  updateUnionid
} from "./auth.repository";
import { getWechatAccessToken } from "../../integrations/wechat/client";
import {
  identityRoleMap,
  WechatCode2SessionResponse,
  WechatPhoneResponse
} from "./auth.types";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROLE_MERCHANT = 2;

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

  try {
    await bindPhoneByUserId(userId, phoneNumber);
  } catch (error) {
    toDuplicatePhoneAppError(error);
  }
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
  /** 推广链接中的经纪人 user_no，仅商家注册时尝试绑定 referrer_id */
  brokerUserNo?: string;
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
    idCardValidDate,
    brokerUserNo
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
