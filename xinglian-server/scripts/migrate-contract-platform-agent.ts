/**
 * 执行 sql/alter-users-contract-platform-agent.sql（平台与代理人合同字段 + 合同模板）
 * 须在 xinglian-server 目录执行：npm run migrate:contract-platform-agent
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function columnExists(
  conn: mysql.Connection,
  table: string,
  column: string
): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "xinglian";

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

  const hasSignedAt = await columnExists(conn, "users", "contract_platform_agent_signed_at");
  const hasSigUrl = await columnExists(conn, "users", "contract_platform_agent_signature_url");

  if (!hasSignedAt) {
    await conn.query(
      `ALTER TABLE users
       ADD COLUMN contract_platform_agent_signed_at DATETIME NULL DEFAULT NULL
         COMMENT '平台与代理人服务合同签署时间 platform_agent'`
    );
    console.log("已添加 users.contract_platform_agent_signed_at");
  }
  if (!hasSigUrl) {
    await conn.query(
      `ALTER TABLE users
       ADD COLUMN contract_platform_agent_signature_url VARCHAR(255) NULL DEFAULT NULL
         COMMENT '平台与代理人合同手写签名图URL platform_agent'
         AFTER contract_platform_agent_signed_at`
    );
    console.log("已添加 users.contract_platform_agent_signature_url");
  }
  if (hasSignedAt && hasSigUrl) {
    console.log("users 表代理人合同字段已齐全，跳过 ALTER");
  }

  const [tplRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM contract_templates WHERE contract_kind = ? LIMIT 1`,
    ["platform_agent"]
  );
  if (!tplRows.length) {
    await conn.query(
      `INSERT INTO contract_templates (contract_kind, title, content_html) VALUES (?, ?, ?)`,
      ["platform_agent", "平台与代理人服务合同", ""]
    );
    console.log("已插入 contract_templates.platform_agent");
  } else {
    console.log("contract_templates.platform_agent 已存在");
  }

  await conn.end();
  console.log("migrate:contract-platform-agent 完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
