/**
 * 将旧版「模块待审、图片无 reviewStatus」的数据补齐为单图待审并写回 JSON。
 * 须在 xinglian-server 目录执行：npm run migrate:legacy-content-review-photos
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

import {
  CONTENT_REVIEW_STATUS,
  materializeLegacyPhotoReviewsInPayload,
  type ModelContentReviewSection
} from "../src/modules/model/model-content-review";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type ExtraRow = mysql.RowDataPacket & {
  user_id: number;
  card_json: string | null;
  card_review_status: number;
  portfolio_json: string | null;
  portfolio_review_status: number;
  style_position_json: string | null;
  style_position_review_status: number;
};

const SECTIONS: Array<{
  section: ModelContentReviewSection;
  json: keyof ExtraRow;
  status: keyof ExtraRow;
}> = [
  { section: "card", json: "card_json", status: "card_review_status" },
  { section: "portfolio", json: "portfolio_json", status: "portfolio_review_status" },
  { section: "stylePosition", json: "style_position_json", status: "style_position_review_status" }
];

function parseJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "xinglian";

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4"
  });

  const [rows] = await conn.query<ExtraRow[]>(
    `SELECT user_id, card_json, card_review_status,
            portfolio_json, portfolio_review_status,
            style_position_json, style_position_review_status
     FROM model_extra_data`
  );

  let updatedRows = 0;
  for (const row of rows) {
    let changed = false;
    const updates: Partial<Record<keyof ExtraRow, string>> = {};

    for (const meta of SECTIONS) {
      if (Number(row[meta.status] ?? CONTENT_REVIEW_STATUS.APPROVED) !== CONTENT_REVIEW_STATUS.PENDING) {
        continue;
      }
      const before = parseJson(row[meta.json] as string | null);
      const after = materializeLegacyPhotoReviewsInPayload(meta.section, before, row[meta.status]);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        updates[meta.json] = JSON.stringify(after);
        changed = true;
      }
    }

    if (!changed) continue;
    updatedRows += 1;
    await conn.query(
      `UPDATE model_extra_data
       SET card_json = COALESCE(?, card_json),
           portfolio_json = COALESCE(?, portfolio_json),
           style_position_json = COALESCE(?, style_position_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        updates.card_json ?? null,
        updates.portfolio_json ?? null,
        updates.style_position_json ?? null,
        row.user_id
      ]
    );
  }

  await conn.end();
  console.log(`已补齐 ${updatedRows} 条 model_extra_data 的单图待审状态`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
