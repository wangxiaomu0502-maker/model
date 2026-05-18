import * as tencentcloud from "tencentcloud-sdk-nodejs";
import COS from "cos-nodejs-sdk-v5";

import { env } from "../../config/env";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

type OcrSide = "front" | "back";

type OcrResult =
  | { realName: string; idCardNo: string; idCardFrontUrl: string }
  | { issueAuthority: string; validDate: string; idCardBackUrl: string };

const OcrClient = tencentcloud.ocr.v20181119.Client;
const cosClient = new COS({
  SecretId: env.cos.secretId,
  SecretKey: env.cos.secretKey
});

function extFromMime(mimetype: string): string {
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  return ".jpg";
}

function normalizePublicBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function putObjectToCos(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    cosClient.putObject(
      {
        Bucket: env.cos.bucket,
        Region: env.cos.region,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

async function uploadIdCardImageToCos(params: {
  userId: number;
  side: OcrSide;
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  const ext = extFromMime(params.mimetype);
  const objectKey = `users/id-cards/${params.userId}/${params.side}-${Date.now()}${ext}`;
  try {
    await putObjectToCos({
      key: objectKey,
      body: params.body,
      contentType: params.mimetype
    });
  } catch (error) {
    const message = (error as { message?: string })?.message || "upload id card image to cos failed";
    throw new AppError(message, 502, ErrorCodes.UPSTREAM_ERROR);
  }
  const base = normalizePublicBaseUrl(env.cos.publicBaseUrl);
  return `${base}/${objectKey}`;
}

function normalizeSide(side: string | undefined): OcrSide {
  const value = String(side || "").trim().toLowerCase();
  if (value === "front" || value === "back") {
    return value;
  }
  throw new AppError("invalid side, expected front or back", 400, ErrorCodes.VALIDATION_ERROR);
}

export async function detectIdCardBySide(params: {
  userId: number;
  side: string | undefined;
  fileBuffer: Buffer;
  mimetype: string;
}): Promise<OcrResult> {
  const side = normalizeSide(params.side);
  const cardSide = side === "front" ? "FRONT" : "BACK";
  const imageUrl = await uploadIdCardImageToCos({
    userId: params.userId,
    side,
    body: params.fileBuffer,
    mimetype: params.mimetype
  });

  const client = new OcrClient({
    credential: {
      secretId: env.cos.secretId,
      secretKey: env.cos.secretKey
    },
    region: env.ocr.region,
    profile: {
      httpProfile: {
        endpoint: "ocr.tencentcloudapi.com"
      }
    }
  });

  try {
    const response = await client.IDCardOCR({
      ImageBase64: params.fileBuffer.toString("base64"),
      CardSide: cardSide
    });

    if (side === "front") {
      const realName = String(response.Name || "").trim();
      const idCardNo = String(response.IdNum || "").trim();
      if (!realName || !idCardNo) {
        throw new AppError("ocr front side result incomplete", 502, ErrorCodes.UPSTREAM_ERROR);
      }
      return { realName, idCardNo, idCardFrontUrl: imageUrl };
    }

    const issueAuthority = String(response.Authority || "").trim();
    const validDate = String(response.ValidDate || "").trim();
    if (!issueAuthority || !validDate) {
      throw new AppError("ocr back side result incomplete", 502, ErrorCodes.UPSTREAM_ERROR);
    }
    return { issueAuthority, validDate, idCardBackUrl: imageUrl };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const message =
      (error as { message?: string })?.message || "id card ocr failed";
    throw new AppError(message, 502, ErrorCodes.UPSTREAM_ERROR);
  }
}
