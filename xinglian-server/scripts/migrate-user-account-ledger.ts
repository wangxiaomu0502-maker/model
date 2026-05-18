/**
 * 执行仓库根目录 sql/create-user-account-ledger.sql，创建用户账户流水与余额表。
 * 须在 xinglian-server 目录执行：npm run migrate:user-account-ledger
 */
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const sqlPath = path.join(process.cwd(), "..", "sql", "create-user-account-ledger.sql");

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "xinglian";

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL 文件不存在: ${sqlPath}（请在 xinglian-server 目录运行本脚本）`);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
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
  await conn.query(sql);
  await conn.end();

  console.log("已执行 create-user-account-ledger.sql（user_account_ledger、user_account_balance）");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
