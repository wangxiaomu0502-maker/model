/**
 * 执行 sql/alter-model-extra-data-content-review.sql（模卡/作品集/风格定位分项审核字段）
 * 须在 xinglian-server 目录执行：npm run migrate:model-content-review
 */
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const sqlPath = path.join(process.cwd(), "..", "sql", "alter-model-extra-data-content-review.sql");
const MARKER_COLUMN = "card_review_status";

async function columnExists(conn: mysql.Connection, columnName: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'model_extra_data'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "xinglian";

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL 文件不存在: ${sqlPath}（请在 xinglian-server 目录运行本脚本）`);
  }

  console.log(`连接 ${user}@${host}:${port}/${database} …`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    charset: "utf8mb4"
  });

  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

  if (await columnExists(conn, MARKER_COLUMN)) {
    console.log("model_extra_data 内容审核字段已存在，跳过迁移");
    await conn.end();
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  await conn.query(sql);
  await conn.end();
  console.log("已执行 alter-model-extra-data-content-review.sql");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
