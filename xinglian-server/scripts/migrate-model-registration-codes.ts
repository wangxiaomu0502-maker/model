/**
 * 创建 model_registration_codes 表
 * 须在 xinglian-server 目录执行：npm run migrate:model-registration-codes
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

  const sqlPath = path.join(process.cwd(), "..", "sql", "create-model-registration-codes-table.sql");
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
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SHOW TABLES LIKE 'model_registration_codes'`
    );
    if (!rows.length) {
      throw new Error("table model_registration_codes was not created");
    }
    console.log(`[migrate] model_registration_codes ready on ${database}@${host}:${port}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
