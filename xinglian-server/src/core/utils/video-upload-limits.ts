import multer from "multer";

const DEFAULT_VIDEO_UPLOAD_MAX_MB = 50;

function parsePositiveMb(value: string | undefined): number {
  if (!value) return DEFAULT_VIDEO_UPLOAD_MAX_MB;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_VIDEO_UPLOAD_MAX_MB;
  return n;
}

export const VIDEO_UPLOAD_MAX_MB = parsePositiveMb(process.env.VIDEO_UPLOAD_MAX_MB);
export const VIDEO_UPLOAD_MAX_BYTES = Math.floor(VIDEO_UPLOAD_MAX_MB * 1024 * 1024);
export const VIDEO_UPLOAD_MAX_LABEL = `${VIDEO_UPLOAD_MAX_MB}MB`;

export function createVideoMemoryUploader(): multer.Multer {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: VIDEO_UPLOAD_MAX_BYTES }
  });
}
