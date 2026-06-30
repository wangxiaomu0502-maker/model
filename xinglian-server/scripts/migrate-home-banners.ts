/**
 * 创建 home_banners 表
 * 须在 xinglian-server 目录执行：npm run migrate:home-banners
 */
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "xinglian";

  const sqlPath = path.join(process.cwd(), "..", "sql", "create-home-banners-table.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4",
    multipleStatements: true
  });

  try {
    await conn.query(sql);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`SHOW TABLES LIKE 'home_banners'`);
    if (!rows.length) {
      throw new Error("table home_banners was not created");
    }
    console.log(`[migrate] home_banners ready on ${database}@${host}:${port}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
