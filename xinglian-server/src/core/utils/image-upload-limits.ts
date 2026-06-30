import multer from "multer";

const DEFAULT_IMAGE_UPLOAD_MAX_MB = 10;

function parsePositiveMb(value: string | undefined): number {
  if (!value) return DEFAULT_IMAGE_UPLOAD_MAX_MB;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_IMAGE_UPLOAD_MAX_MB;
  return n;
}

export const IMAGE_UPLOAD_MAX_MB = parsePositiveMb(process.env.IMAGE_UPLOAD_MAX_MB);
export const IMAGE_UPLOAD_MAX_BYTES = Math.floor(IMAGE_UPLOAD_MAX_MB * 1024 * 1024);
export const IMAGE_UPLOAD_MAX_LABEL = `${IMAGE_UPLOAD_MAX_MB}MB`;

export function createImageMemoryUploader(): multer.Multer {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES }
  });
}
