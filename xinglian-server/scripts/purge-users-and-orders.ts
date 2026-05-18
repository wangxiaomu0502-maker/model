/**
 * 清空 C 端用户、订单及账户流水；保留 admin_users 与运营配置表。
 * 在 xinglian-server 目录执行：npm run purge:users-orders
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const TABLES_IN_ORDER = [
  "user_account_ledger",
  "user_account_balance",
  "orders",
  "model_profile_categories",
  "model_extra_data",
  "model_profiles",
  "merchant_profiles",
  "broker_profiles",
  "agent_profiles",
  "users"
] as const;

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
    charset: "utf8mb4"
  });

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  for (const table of TABLES_IN_ORDER) {
    try {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  ✓ TRUNCATE ${table}`);
    } catch (err) {
      const code = String((err as { code?: string }).code || "");
      if (code === "ER_NO_SUCH_TABLE") {
        console.log(`  - 跳过（表不存在）${table}`);
        continue;
      }
      throw err;
    }
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  const [[usersRow]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM users"
  );
  const [[ordersRow]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM orders"
  );
  const [[adminRow]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM admin_users"
  );

  await conn.end();

  console.log("\n完成：");
  console.log(`  users: ${usersRow?.cnt ?? "?"} 条`);
  console.log(`  orders: ${ordersRow?.cnt ?? "?"} 条`);
  console.log(`  admin_users: ${adminRow?.cnt ?? "?"} 条（已保留）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
