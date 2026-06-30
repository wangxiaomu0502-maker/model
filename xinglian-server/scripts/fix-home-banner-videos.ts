/**
 * 将库内 H.265 Banner 视频转码为 H.264 并更新 COS 地址
 * 须在 xinglian-server 目录执行：npm run fix:home-banner-videos
 */
import dotenv from "dotenv";
import path from "node:path";

import { RowDataPacket } from "mysql2";

import { dbPool } from "../src/config/db";
import { detectMp4VideoCodec } from "../src/modules/home-banner/home-banner-video-codec";
import { uploadAdminHomeBannerVideoToCos } from "../src/modules/home-banner/home-banner-media.storage";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type BannerRow = RowDataPacket & {
  id: number;
  video_url: string | null;
};

async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败 ${url} (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main(): Promise<void> {
  const [rows] = await dbPool.query<BannerRow[]>(
    `SELECT id, video_url FROM home_banners WHERE type = 'video' AND video_url IS NOT NULL AND video_url <> ''`
  );
  if (!rows.length) {
    console.log("[fix] no video banners");
    return;
  }

  for (const row of rows) {
    const videoUrl = String(row.video_url || "").trim();
    if (!videoUrl) continue;
    console.log(`[fix] banner #${row.id} downloading...`);
    const body = await downloadVideo(videoUrl);
    const codec = detectMp4VideoCodec(body);
    console.log(`[fix] banner #${row.id} codec=${codec}`);
    if (codec === "h264") {
      console.log(`[fix] banner #${row.id} already h264, skip`);
      continue;
    }
    const newUrl = await uploadAdminHomeBannerVideoToCos({
      adminUserId: 0,
      body,
      mimetype: "video/mp4"
    });
    await dbPool.query(`UPDATE home_banners SET video_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      newUrl,
      row.id
    ]);
    console.log(`[fix] banner #${row.id} updated -> ${newUrl}`);
  }
}

main()
  .then(() => {
    console.log("[fix] done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[fix] failed:", error);
    process.exit(1);
  });
