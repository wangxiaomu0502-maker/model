/**
 * 将 LV1 及以上模特统一回落为 LV1（LV0 不变）。
 *
 * - 清除 model_level_override = 2/3/4/5 的手动等级
 * - 有模卡 → 自动 LV1；无模卡 → LV0
 *
 * 执行：在 xinglian-server 目录
 *   npm run reset:model-levels-lv1-lv3 -- --dry-run
 *   npm run reset:model-levels-lv1-lv3
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const dryRun = process.argv.includes("--dry-run");

function stripEnvQuotes(value: string | undefined): string {
  const v = value ?? "";
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }
  return v;
}

const LEGACY_LEVEL_EXPR = `COALESCE(
  mp.model_level_override,
  CASE
    WHEN (
      CAST(mex.card_json AS CHAR) LIKE '%\\"url\\"%'
      OR CAST(mex.card_json AS CHAR) LIKE '%\\"measurements\\"%'
    )
    AND CAST(mex.style_position_json AS CHAR) LIKE '%\\"url\\"%'
    AND CAST(mex.portfolio_json AS CHAR) LIKE '%\\"url\\"%' THEN 3
    WHEN (
      CAST(mex.card_json AS CHAR) LIKE '%\\"url\\"%'
      OR CAST(mex.card_json AS CHAR) LIKE '%\\"measurements\\"%'
    )
    AND CAST(mex.style_position_json AS CHAR) LIKE '%\\"url\\"%' THEN 2
    WHEN (
      CAST(mex.card_json AS CHAR) LIKE '%\\"url\\"%'
      OR CAST(mex.card_json AS CHAR) LIKE '%\\"measurements\\"%'
    ) THEN 1
    ELSE 0
  END
)`;

const NEW_LEVEL_EXPR = `COALESCE(
  mp.model_level_override,
  CASE
    WHEN (
      CAST(mex.card_json AS CHAR) LIKE '%\\"url\\"%'
      OR CAST(mex.card_json AS CHAR) LIKE '%\\"measurements\\"%'
    ) THEN 1
    ELSE 0
  END
)`;

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = stripEnvQuotes(process.env.DB_PASSWORD);
  const database = process.env.DB_NAME ?? "xinglian";

  console.log(`${dryRun ? "[dry-run] " : ""}连接 ${user}@${host}:${port}/${database} ...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4"
  });

  const [summary] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN ${LEGACY_LEVEL_EXPR} = 1 THEN 1 ELSE 0 END) AS legacy_lv1,
       SUM(CASE WHEN ${LEGACY_LEVEL_EXPR} = 2 THEN 1 ELSE 0 END) AS legacy_lv2,
       SUM(CASE WHEN ${LEGACY_LEVEL_EXPR} = 3 THEN 1 ELSE 0 END) AS legacy_lv3,
       SUM(CASE WHEN ${LEGACY_LEVEL_EXPR} IN (4, 5) THEN 1 ELSE 0 END) AS legacy_lv45
     FROM users u
     INNER JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN model_extra_data mex ON mex.user_id = u.id
     WHERE u.deleted_at IS NULL AND u.role = 1`
  );

  const row = summary[0] ?? {};
  console.log("\n迁移前（旧规则统计）：");
  console.log(`  LV1: ${row.legacy_lv1 ?? 0}`);
  console.log(`  LV2: ${row.legacy_lv2 ?? 0}`);
  console.log(`  LV3: ${row.legacy_lv3 ?? 0}`);
  console.log(`  LV4/LV5: ${row.legacy_lv45 ?? 0}`);

  const [toClearOverride] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT u.id, u.user_no, u.nickname, mp.model_level_override
     FROM users u
     INNER JOIN model_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 1
       AND mp.model_level_override IN (2, 3, 4, 5)
     ORDER BY u.id`
  );

  console.log(`\n待清除手动等级 override 2/3/4/5：${toClearOverride.length} 个`);
  for (const item of toClearOverride.slice(0, 20)) {
    console.log(
      `  - ${item.user_no} id=${item.id} ${item.nickname ?? ""} override=${item.model_level_override}`
    );
  }
  if (toClearOverride.length > 20) {
    console.log(`  ... 另有 ${toClearOverride.length - 20} 条`);
  }

  if (dryRun) {
    const [afterPreview] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 0 THEN 1 ELSE 0 END) AS new_lv0,
         SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 1 THEN 1 ELSE 0 END) AS new_lv1,
         SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 2 THEN 1 ELSE 0 END) AS new_lv2,
         SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 3 THEN 1 ELSE 0 END) AS new_lv3,
         SUM(CASE WHEN ${NEW_LEVEL_EXPR} IN (4, 5) THEN 1 ELSE 0 END) AS new_lv45
       FROM users u
       INNER JOIN model_profiles mp ON mp.user_id = u.id
       LEFT JOIN model_extra_data mex ON mex.user_id = u.id
       WHERE u.deleted_at IS NULL AND u.role = 1`
    );
    const preview = afterPreview[0] ?? {};
    console.log("\n[dry-run] 清除 override 2/3/4/5 后（新规则统计）：");
    console.log(`  LV0: ${preview.new_lv0 ?? 0}`);
    console.log(`  LV1: ${preview.new_lv1 ?? 0}`);
    console.log(`  LV2: ${preview.new_lv2 ?? 0}`);
    console.log(`  LV3: ${preview.new_lv3 ?? 0}`);
    console.log(`  LV4/LV5: ${preview.new_lv45 ?? 0}`);
    await conn.end();
    return;
  }

  await conn.beginTransaction();
  try {
    const [result] = await conn.query<mysql.ResultSetHeader>(
      `UPDATE model_profiles mp
       INNER JOIN users u ON u.id = mp.user_id
       SET mp.model_level_override = NULL,
           mp.updated_at = CURRENT_TIMESTAMP
       WHERE u.deleted_at IS NULL
         AND u.role = 1
         AND mp.model_level_override IN (2, 3, 4, 5)`
    );
    console.log(`\n已清除 override 2/3/4/5：${result.affectedRows} 行`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  const [afterSummary] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 0 THEN 1 ELSE 0 END) AS new_lv0,
       SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 1 THEN 1 ELSE 0 END) AS new_lv1,
       SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 2 THEN 1 ELSE 0 END) AS new_lv2,
       SUM(CASE WHEN ${NEW_LEVEL_EXPR} = 3 THEN 1 ELSE 0 END) AS new_lv3,
       SUM(CASE WHEN ${NEW_LEVEL_EXPR} IN (4, 5) THEN 1 ELSE 0 END) AS new_lv45
     FROM users u
     INNER JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN model_extra_data mex ON mex.user_id = u.id
     WHERE u.deleted_at IS NULL AND u.role = 1`
  );
  const after = afterSummary[0] ?? {};
  console.log("\n迁移后（新规则统计）：");
  console.log(`  LV0: ${after.new_lv0 ?? 0}`);
  console.log(`  LV1: ${after.new_lv1 ?? 0}`);
  console.log(`  LV2: ${after.new_lv2 ?? 0}`);
  console.log(`  LV3: ${after.new_lv3 ?? 0}`);
  console.log(`  LV4/LV5: ${after.new_lv45 ?? 0}`);

  await conn.end();
  console.log("\n完成。LV1 及以上已统一回落为 LV1（无模卡则为 LV0）。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
