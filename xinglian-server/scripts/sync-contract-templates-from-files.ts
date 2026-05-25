/**
 * 将 合同/*.txt 同步到 contract_templates 表（title + content_html）
 * 在 xinglian-server 目录执行：npm run sync:contract-templates
 *
 * 可选：--write-sql  生成 sql/update-contract-templates-content.sql 而不连库
 */
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

import { contractTextToHtml } from "./lib/contract-text-to-html";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const CONTRACT_FILES: Array<{ kind: string; file: string; title: string }> = [
  {
    kind: "platform_agent",
    file: "代理人.txt",
    title: "代理人平台入驻协议（线上版）"
  },
  {
    kind: "platform_broker",
    file: "经纪人.txt",
    title: "经纪人入驻合作协议（线上版）"
  },
  {
    kind: "broker_model",
    file: "模特.txt",
    title: "模特入驻合作协议（线上版）"
  },
  {
    kind: "platform_merchant",
    file: "商家.txt",
    title: "商家入驻合作协议（线上版）"
  }
];

function repoRoot(): string {
  return path.resolve(process.cwd(), "..");
}

function contractDir(): string {
  return path.join(repoRoot(), "合同");
}

function loadContractEntry(entry: (typeof CONTRACT_FILES)[number]): {
  kind: string;
  title: string;
  contentHtml: string;
} {
  const filePath = path.join(contractDir(), entry.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`contract file not found: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  return {
    kind: entry.kind,
    title: entry.title,
    contentHtml: contractTextToHtml(text)
  };
}

function mysqlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function buildSql(items: Array<{ kind: string; title: string; contentHtml: string }>): string {
  const lines = [
    "-- 由 npm run sync:contract-templates -- --write-sql 生成",
    "-- 执行示例：",
    "--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -u USER -p DB_NAME < sql/update-contract-templates-content.sql",
    "",
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;",
    ""
  ];

  for (const item of items) {
    lines.push(
      `UPDATE contract_templates SET`,
      `  title = '${mysqlEscape(item.title)}',`,
      `  content_html = '${mysqlEscape(item.contentHtml)}',`,
      `  updated_at = CURRENT_TIMESTAMP`,
      `WHERE contract_kind = '${mysqlEscape(item.kind)}';`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

async function syncToDatabase(
  items: Array<{ kind: string; title: string; contentHtml: string }>
): Promise<void> {
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
    charset: "utf8mb4"
  });

  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

  for (const item of items) {
    const [result] = await conn.query<mysql.ResultSetHeader>(
      `UPDATE contract_templates
       SET title = ?, content_html = ?, updated_at = CURRENT_TIMESTAMP
       WHERE contract_kind = ?`,
      [item.title, item.contentHtml, item.kind]
    );
    if (result.affectedRows === 0) {
      await conn.query(
        `INSERT INTO contract_templates (contract_kind, title, content_html) VALUES (?, ?, ?)`,
        [item.kind, item.title, item.contentHtml]
      );
      console.log(`已插入 ${item.kind}`);
    } else {
      console.log(`已更新 ${item.kind}`);
    }
  }

  await conn.end();
}

async function main(): Promise<void> {
  const writeSql = process.argv.includes("--write-sql");
  const items = CONTRACT_FILES.map(loadContractEntry);

  if (writeSql) {
    const sqlPath = path.join(repoRoot(), "sql", "update-contract-templates-content.sql");
    fs.writeFileSync(sqlPath, buildSql(items), "utf8");
    console.log(`已写入 ${sqlPath}`);
    return;
  }

  await syncToDatabase(items);
  console.log("sync:contract-templates 完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
