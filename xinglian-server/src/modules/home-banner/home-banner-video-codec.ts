export type Mp4VideoCodec = "h264" | "hevc" | "unknown";

export function detectMp4VideoCodec(body: Buffer): Mp4VideoCodec {
  if (!body?.length) return "unknown";
  const sample = body.subarray(0, Math.min(body.length, 1024 * 1024)).toString("latin1");
  if (/hvc1|hev1|hvcC/i.test(sample)) return "hevc";
  if (/avc1|avc3|avcC/i.test(sample)) return "h264";
  return "unknown";
}
