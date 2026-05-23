const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 小程序 wx.uploadFile 常不带正确 Content-Type，需结合扩展名与文件头判断 */
export function resolveImageUploadMime(file: {
  mimetype?: string;
  originalname?: string;
  buffer?: Buffer;
}): string | null {
  const headerMime = String(file.mimetype || "")
    .trim()
    .toLowerCase();
  if (IMAGE_MIME.has(headerMime)) {
    return headerMime;
  }

  const name = String(file.originalname || "").trim().toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";

  const buf = file.buffer;
  if (buf && buf.length >= 12) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return "image/png";
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    ) {
      return "image/webp";
    }
  }

  if (headerMime === "application/octet-stream" && buf && buf.length > 0) {
    return "image/jpeg";
  }

  return null;
}
