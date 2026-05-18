/**
 * 分账 v2 库表迁移（幂等：已存在列/索引则跳过）
 * xinglian-server 目录：npm run migrate:split-v2
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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(
  conn: mysql.Connection,
  sql: string,
  table: string,
  column: string
): Promise<void> {
  if (await columnExists(conn, table, column)) {
    console.log(`  - 跳过（已存在）${table}.${column}`);
    return;
  }
  await conn.query(sql);
  console.log(`  ✓ ${table}.${column}`);
}

async function renameColumnIfOldExists(
  conn: mysql.Connection,
  table: string,
  oldName: string,
  newName: string,
  definition: string
): Promise<void> {
  if (await columnExists(conn, table, newName)) {
    console.log(`  - 跳过（已重命名）${table}.${newName}`);
    return;
  }
  if (!(await columnExists(conn, table, oldName))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${newName}\` ${definition}`);
    console.log(`  ✓ 新增 ${table}.${newName}`);
    return;
  }
  await conn.query(
    `ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldName}\` \`${newName}\` ${definition}`
  );
  console.log(`  ✓ ${table}.${oldName} -> ${newName}`);
}

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    charset: "utf8mb4"
  });

  console.log("users.agent_user_id …");
  await addColumnIfMissing(
    conn,
    `ALTER TABLE users ADD COLUMN agent_user_id BIGINT UNSIGNED NULL
     COMMENT '所属代理人 users.id，仅 role=1' AFTER referrer_id`,
    "users",
    "agent_user_id"
  );

  const [cleared] = await conn.query<mysql.ResultSetHeader>(
    "UPDATE users SET referrer_id = NULL WHERE role = 1 AND referrer_id IS NOT NULL"
  );
  console.log(`  ✓ 清空模特 referrer_id（${cleared.affectedRows} 行）`);

  console.log("platform_split_rules 服务费三方占比 …");
  for (const [col, def] of [
    ["platform_share_of_fee_bp", "SMALLINT UNSIGNED NOT NULL DEFAULT 3400 COMMENT '服务费内平台占比'"],
    ["agent_share_of_fee_bp", "SMALLINT UNSIGNED NOT NULL DEFAULT 3300 COMMENT '服务费内代理人占比'"],
    ["broker_share_of_fee_bp", "SMALLINT UNSIGNED NOT NULL DEFAULT 3300 COMMENT '服务费内经纪人占比'"]
  ] as const) {
    await addColumnIfMissing(
      conn,
      `ALTER TABLE platform_split_rules ADD COLUMN ${col} ${def} AFTER model_share_bp`,
      "platform_split_rules",
      col
    );
  }

  await conn.query(
    `UPDATE platform_split_rules SET
       model_share_bp = 8500,
       platform_fee_rate_bp = 1500,
       platform_share_of_fee_bp = 3400,
       agent_share_of_fee_bp = 3300,
       broker_share_of_fee_bp = 3300
     WHERE id = 1`
  );
  console.log("  ✓ 默认分账比例已写入 id=1");

  console.log("orders 分账列重命名 …");
  await renameColumnIfOldExists(
    conn,
    "orders",
    "merchant_referrer_user_id",
    "broker_user_id",
    "BIGINT UNSIGNED NULL COMMENT '商户绑定经纪人 users.id'"
  );
  await renameColumnIfOldExists(
    conn,
    "orders",
    "model_referrer_user_id",
    "agent_user_id",
    "BIGINT UNSIGNED NULL COMMENT '模特所属代理人 users.id'"
  );
  await renameColumnIfOldExists(
    conn,
    "orders",
    "merchant_referrer_income",
    "broker_income",
    "DECIMAL(10, 2) NULL COMMENT '经纪人分成(元)'"
  );
  await renameColumnIfOldExists(
    conn,
    "orders",
    "model_referrer_income",
    "agent_income",
    "DECIMAL(10, 2) NULL COMMENT '代理人分成(元)'"
  );

  await conn.end();
  console.log("\n分账 v2 迁移完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
