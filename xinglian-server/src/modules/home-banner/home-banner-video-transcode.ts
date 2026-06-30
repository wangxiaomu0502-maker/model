import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { Mp4VideoCodec } from "./home-banner-video-codec";

const execFileAsync = promisify(execFile);

async function resolveFfmpegPath(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("which", ["ffmpeg"]);
    const bin = stdout.trim();
    return bin || null;
  } catch {
    return null;
  }
}

export async function transcodeHomeBannerVideoToH264(input: {
  body: Buffer;
  ext: ".mp4" | ".mov";
}): Promise<{ body: Buffer; mimetype: "video/mp4"; transcoded: boolean }> {
  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    return { body: input.body, mimetype: "video/mp4", transcoded: false };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "home-banner-video-"));
  const inputPath = path.join(tmpDir, `input${input.ext}`);
  const outputPath = path.join(tmpDir, "output.mp4");
  try {
    await fs.writeFile(inputPath, input.body);
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outputPath
      ],
      { timeout: 180000, maxBuffer: 32 * 1024 * 1024 }
    );
    const body = await fs.readFile(outputPath);
    if (!body.length) {
      return { body: input.body, mimetype: "video/mp4", transcoded: false };
    }
    return { body, mimetype: "video/mp4", transcoded: true };
  } catch {
    return { body: input.body, mimetype: "video/mp4", transcoded: false };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function ensureMiniappCompatibleMp4(input: {
  body: Buffer;
  ext: ".mp4" | ".mov";
  codec: Mp4VideoCodec;
}): Promise<{ body: Buffer; mimetype: "video/mp4" }> {
  if (input.codec === "h264") {
    return { body: input.body, mimetype: "video/mp4" };
  }

  const transcoded = await transcodeHomeBannerVideoToH264({
    body: input.body,
    ext: input.ext
  });
  if (transcoded.transcoded) {
    return { body: transcoded.body, mimetype: "video/mp4" };
  }

  if (input.codec === "hevc") {
    throw new Error(
      "视频为 H.265/HEVC 编码的 MP4，微信小程序无法播放。请用剪映/格式工厂等导出为 H.264 编码的 MP4 后重新上传。"
    );
  }

  return { body: input.body, mimetype: "video/mp4" };
}
