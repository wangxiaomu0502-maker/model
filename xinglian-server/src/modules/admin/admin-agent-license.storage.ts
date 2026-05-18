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
  if (mimetype === "application/pdf") return ".pdf";
  return ".jpg";
}

export async function uploadAgentBusinessLicenseToCos(input: {
  adminUserId: number;
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  if (!input.body?.length) {
    throw new AppError("营业执照文件为空", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(input.mimetype)) {
    throw new AppError("仅支持 JPG、PNG、WEBP、PDF", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const ext = extFromMime(input.mimetype);
  const objectKey = `admin/agents/license/${input.adminUserId}/${Date.now()}${ext}`;

  await new Promise<void>((resolve, reject) => {
    cosClient.putObject(
      {
        Bucket: env.cos.bucket,
        Region: env.cos.region,
        Key: objectKey,
        Body: input.body,
        ContentType: input.mimetype
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  }).catch((err: unknown) => {
    const e = err as { error?: { Message?: string }; message?: string };
    throw new AppError(
      `营业执照上传失败：${e?.error?.Message || e?.message || "COS error"}`,
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  });

  const base = env.cos.publicBaseUrl.replace(/\/+$/, "");
  return `${base}/${objectKey}`;
}
