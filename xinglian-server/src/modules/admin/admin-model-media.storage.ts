import COS from "cos-nodejs-sdk-v5";

import { env } from "../../config/env";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

const cosClient = new COS({
  SecretId: env.cos.secretId,
  SecretKey: env.cos.secretKey
});

function extFromMime(mimetype: string): string {
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  return ".jpg";
}

async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    cosClient.putObject(
      {
        Bucket: env.cos.bucket,
        Region: env.cos.region,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  }).catch((err: unknown) => {
    const e = err as { error?: { Message?: string }; message?: string };
    throw new AppError(
      `图片上传失败：${e?.error?.Message || e?.message || "COS error"}`,
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  });
}

function publicUrl(objectKey: string): string {
  const base = env.cos.publicBaseUrl.replace(/\/+$/, "");
  return `${base}/${objectKey}`;
}

export async function uploadAdminModelImageToCos(input: {
  adminUserId: number;
  kind: "avatar" | "card" | "portfolio" | "style";
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(input.mimetype)) {
    throw new AppError("仅支持 JPG、PNG、WEBP", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (!input.body?.length) {
    throw new AppError("图片文件为空", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const ext = extFromMime(input.mimetype);
  const objectKey = `admin/models/${input.kind}/${input.adminUserId}/${Date.now()}${ext}`;
  await putObject({
    key: objectKey,
    body: input.body,
    contentType: input.mimetype
  });
  return publicUrl(objectKey);
}

export async function uploadAdminAssetImageToCos(input: {
  adminUserId: number;
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(input.mimetype)) {
    throw new AppError("仅支持 JPG、PNG、WEBP", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (!input.body?.length) {
    throw new AppError("图片文件为空", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const ext = extFromMime(input.mimetype);
  const suffix = Math.random().toString(36).slice(2, 10);
  const objectKey = `admin/assets/${input.adminUserId}/${Date.now()}-${suffix}${ext}`;
  await putObject({
    key: objectKey,
    body: input.body,
    contentType: input.mimetype
  });
  return publicUrl(objectKey);
}
