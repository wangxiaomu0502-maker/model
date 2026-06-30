import COS from "cos-nodejs-sdk-v5";

import { env } from "../../config/env";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

import { detectMp4VideoCodec } from "./home-banner-video-codec";
import { ensureMiniappCompatibleMp4 } from "./home-banner-video-transcode";

const cosClient = new COS({
  SecretId: env.cos.secretId,
  SecretKey: env.cos.secretKey
});

function extFromVideoMime(mimetype: string): string {
  if (mimetype === "video/quicktime") return ".mov";
  return ".mp4";
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
      `视频上传失败：${e?.error?.Message || e?.message || "COS error"}`,
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  });
}

function publicUrl(objectKey: string): string {
  const base = env.cos.publicBaseUrl.replace(/\/+$/, "");
  return `${base}/${objectKey}`;
}

export async function uploadAdminHomeBannerVideoToCos(input: {
  adminUserId: number;
  body: Buffer;
  mimetype: string;
}): Promise<string> {
  const allowed = ["video/mp4", "video/quicktime"];
  if (!allowed.includes(input.mimetype)) {
    throw new AppError("仅支持 MP4、MOV 视频", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (!input.body?.length) {
    throw new AppError("视频文件为空", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const ext = extFromVideoMime(input.mimetype) as ".mp4" | ".mov";
  const codec = detectMp4VideoCodec(input.body);
  let prepared: { body: Buffer; mimetype: "video/mp4" };
  try {
    prepared = await ensureMiniappCompatibleMp4({
      body: input.body,
      ext,
      codec
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? error.message
        : "视频编码不受支持，请上传 H.264 编码的 MP4",
      400,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  const suffix = Math.random().toString(36).slice(2, 10);
  const objectKey = `admin/home-banners/video/${input.adminUserId}/${Date.now()}-${suffix}.mp4`;
  await putObject({
    key: objectKey,
    body: prepared.body,
    contentType: prepared.mimetype
  });
  return publicUrl(objectKey);
}
