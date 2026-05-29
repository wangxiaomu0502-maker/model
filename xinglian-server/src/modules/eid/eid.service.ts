import crypto from "node:crypto";

import * as tencentcloud from "tencentcloud-sdk-nodejs";

import { env } from "../../config/env";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

const FaceIdClient = tencentcloud.faceid.v20180301.Client;

function getFaceIdClient() {
  return new FaceIdClient({
    credential: {
      secretId: env.faceid.secretId,
      secretKey: env.faceid.secretKey
    },
    region: env.faceid.region,
    profile: {
      httpProfile: {
        endpoint: "faceid.tencentcloudapi.com"
      }
    }
  });
}

function normalizeRealName(realName: string): string {
  return String(realName || "").trim();
}

function normalizeIdCardNo(idCardNo: string): string {
  return String(idCardNo || "").trim().toUpperCase();
}

function buildEidExtra(params: {
  userId: number;
  realName: string;
  idCardNo: string;
}): string {
  const digest = crypto
    .createHmac("sha256", env.jwt.secret)
    .update(`${normalizeRealName(params.realName)}|${normalizeIdCardNo(params.idCardNo)}`)
    .digest("hex")
    .slice(0, 24);
  return `xinglian:user:${params.userId}:id:${digest}`;
}

function isZero(value: unknown): boolean {
  return Number(value) === 0 || String(value ?? "") === "0";
}

function getTextResult(response: Record<string, unknown>): Record<string, unknown> {
  const text = response.Text;
  return text && typeof text === "object" ? (text as Record<string, unknown>) : {};
}

export async function createEidToken(params: {
  userId: number;
  realName: string;
  idCardNo: string;
}): Promise<{ eidToken: string }> {
  const realName = normalizeRealName(params.realName);
  const idCardNo = normalizeIdCardNo(params.idCardNo);
  if (!realName || !idCardNo) {
    throw new AppError("实名信息不完整", 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const response = await getFaceIdClient().GetEidToken({
      MerchantId: env.faceid.eidMerchantId,
      Name: realName,
      IdCard: idCardNo,
      Extra: buildEidExtra({ userId: params.userId, realName, idCardNo })
    } as never);
    const eidToken = String((response as { EidToken?: string }).EidToken || "").trim();
    if (!eidToken) {
      throw new AppError("获取E证通Token失败", 502, ErrorCodes.UPSTREAM_ERROR);
    }
    return { eidToken };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = (error as { message?: string })?.message || "获取E证通Token失败";
    throw new AppError(message, 502, ErrorCodes.UPSTREAM_ERROR);
  }
}

export async function assertEidVerified(params: {
  userId: number;
  eidToken: string;
  realName: string;
  idCardNo: string;
}): Promise<void> {
  const eidToken = String(params.eidToken || "").trim();
  if (!eidToken) {
    throw new AppError("E证通Token不能为空", 400, ErrorCodes.VALIDATION_ERROR);
  }

  let response: Record<string, unknown>;
  try {
    response = (await getFaceIdClient().GetEidResult({
      EidToken: eidToken,
      InfoType: "1"
    } as never)) as Record<string, unknown>;
  } catch (error) {
    const message = (error as { message?: string })?.message || "获取E证通结果失败";
    throw new AppError(message, 502, ErrorCodes.UPSTREAM_ERROR);
  }

  const text = getTextResult(response);
  const expectedExtra = buildEidExtra({
    userId: params.userId,
    realName: params.realName,
    idCardNo: params.idCardNo
  });
  const extra = String(text.Extra || "").trim();
  const verified =
    isZero(text.ErrCode) &&
    isZero(text.LiveStatus) &&
    isZero(text.Comparestatus) &&
    extra === expectedExtra;

  if (!verified) {
    throw new AppError(
      String(text.ErrMsg || text.LiveMsg || text.Comparemsg || "E证通核验未通过"),
      400,
      ErrorCodes.VALIDATION_ERROR
    );
  }
}

export async function verifyEidResult(params: {
  userId: number;
  eidToken: string;
  realName: string;
  idCardNo: string;
}): Promise<{ verified: true }> {
  await assertEidVerified(params);
  return { verified: true };
}
