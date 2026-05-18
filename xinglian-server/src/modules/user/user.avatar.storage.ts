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

function normalizePublicBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function getCosErrorMessage(err: unknown): string {
  const e = err as {
    code?: string;
    error?: { Code?: string; Message?: string };
    message?: string;
  };
  const code = e?.error?.Code || e?.code || "UnknownCOSCode";
  const message = e?.error?.Message || e?.message || "unknown cos error";
  return `${code}: ${message}`;
}

export async function uploadAvatarToCos(input: {
  userId: number;
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  if (!input.body || input.body.length === 0) {
    throw new AppError("empty avatar file", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const ext = extFromMime(input.mimetype);
  const objectKey = `users/avatars/${input.userId}/${Date.now()}${ext}`;

  try {
    await putObjectToCos({
      key: objectKey,
      body: input.body,
      contentType: input.mimetype
    });
  } catch (err) {
    throw new AppError(
      `failed to upload avatar to cos (${getCosErrorMessage(err)})`,
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  const base = normalizePublicBaseUrl(env.cos.publicBaseUrl);
  return `${base}/${objectKey}`;
}
