/**
 * 清空平台所有非 mock 的模特(role=1)、商家(role=2)、经纪人(role=3) 及其关联数据；
 * 保留 is_mock=1 的 mock 账号、游客(role=0)、代理人(role=4)、后台 admin_users。
 *
 * 执行：在 xinglian-server 目录
 *   npm run purge:non-mock-role-users
 *   npm run purge:non-mock-role-users -- --dry-run
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const TARGET_ROLES = [1, 2, 3] as const;
const dryRun = process.argv.includes("--dry-run");

function stripEnvQuotes(value: string | undefined): string {
  const v = value ?? "";
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }
  return v;
}

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = stripEnvQuotes(process.env.DB_PASSWORD);
  const database = process.env.DB_NAME ?? "xinglian";

  console.log(`${dryRun ? "[dry-run] " : ""}连接 ${user}@${host}:${port}/${database} …`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4"
  });

  const mockPredicate = "COALESCE(u.is_mock, 0) = 1";
  const purgePredicate = `u.role IN (${TARGET_ROLES.join(",")}) AND COALESCE(u.is_mock, 0) = 0 AND u.deleted_at IS NULL`;

  const [toPurge] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT u.id, u.user_no, u.role, u.nickname
     FROM users u
     WHERE ${purgePredicate}
     ORDER BY u.role, u.id`
  );

  const purgeIds = toPurge.map((r) => Number(r.id));
  console.log(`待清理用户 ${purgeIds.length} 个（role 1/2/3 且非 mock）：`);
  for (const row of toPurge.slice(0, 50)) {
    console.log(`  - [${row.role}] ${row.user_no} id=${row.id} ${row.nickname ?? ""}`);
  }
  if (toPurge.length > 50) {
    console.log(`  … 另有 ${toPurge.length - 50} 条`);
  }

  if (purgeIds.length === 0) {
    console.log("\n无需清理。");
    await conn.end();
    return;
  }

  const idPlaceholders = purgeIds.map(() => "?").join(",");
  const idParams = [...purgeIds];

  if (dryRun) {
    const [[orderCnt]] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE merchant_user_id IN (${idPlaceholders}) OR model_user_id IN (${idPlaceholders})
          OR broker_user_id IN (${idPlaceholders}) OR agent_user_id IN (${idPlaceholders})`,
      [...idParams, ...idParams, ...idParams, ...idParams]
    );
    const [[mockKeep]] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users u WHERE ${mockPredicate} AND u.role IN (1,2,3)`
    );
    console.log(`\n[dry-run] 将删除订单约 ${orderCnt?.cnt ?? 0} 条`);
    console.log(`[dry-run] 将保留 mock 用户 ${mockKeep?.cnt ?? 0} 个`);
    await conn.end();
    return;
  }

  const orderMatchSql = `merchant_user_id IN (${idPlaceholders})
          OR model_user_id IN (${idPlaceholders})
          OR broker_user_id IN (${idPlaceholders})
          OR agent_user_id IN (${idPlaceholders})`;
  const orderMatchParams = [...idParams, ...idParams, ...idParams, ...idParams];

  await conn.beginTransaction();
  try {
    await conn.query(
      `UPDATE users SET referrer_id = NULL WHERE referrer_id IN (${idPlaceholders})`,
      idParams
    );
    await conn.query(
      `UPDATE users SET agent_user_id = NULL WHERE agent_user_id IN (${idPlaceholders})`,
      idParams
    );

    if (await tableExists(conn, "order_cs_notes")) {
      await conn.query(
        `DELETE n FROM order_cs_notes n
         INNER JOIN orders o ON o.id = n.order_id
         WHERE ${orderMatchSql}`,
        orderMatchParams
      );
    }

    if (await tableExists(conn, "payment_operation_logs")) {
      await conn.query(
        `DELETE p FROM payment_operation_logs p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE ${orderMatchSql}`,
        orderMatchParams
      );
    }

    if (await tableExists(conn, "user_account_ledger")) {
      await conn.query(
        `DELETE FROM user_account_ledger WHERE user_id IN (${idPlaceholders})`,
        idParams
      );
      await conn.query(
        `DELETE l FROM user_account_ledger l
         INNER JOIN orders o ON o.id = l.order_id
         WHERE ${orderMatchSql}`,
        orderMatchParams
      );
    }

    if (await tableExists(conn, "user_account_balance")) {
      await conn.query(
        `DELETE FROM user_account_balance WHERE user_id IN (${idPlaceholders})`,
        idParams
      );
    }

    await conn.query(`DELETE FROM orders WHERE ${orderMatchSql}`, orderMatchParams);

    await conn.query(
      `DELETE FROM model_profile_categories WHERE user_id IN (${idPlaceholders})`,
      idParams
    );
    await conn.query(
      `DELETE FROM model_extra_data WHERE user_id IN (${idPlaceholders})`,
      idParams
    );
    await conn.query(
      `DELETE FROM model_profiles WHERE user_id IN (${idPlaceholders})`,
      idParams
    );
    await conn.query(
      `DELETE FROM merchant_profiles WHERE user_id IN (${idPlaceholders})`,
      idParams
    );

    if (await tableExists(conn, "broker_profiles")) {
      await conn.query(
        `DELETE FROM broker_profiles WHERE user_id IN (${idPlaceholders})`,
        idParams
      );
    }

    await conn.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, idParams);

    await conn.commit();
    console.log("\n已提交清理。");
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  const [[mockModels]] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users WHERE role = 1 AND COALESCE(is_mock, 0) = 1`
  );
  const [[remainRole]] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT role, COUNT(*) AS cnt FROM users WHERE role IN (1,2,3) GROUP BY role`
  );
  const [[ordersLeft]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM orders"
  );

  await conn.end();

  console.log("\n清理后统计：");
  console.log(`  mock 模特: ${mockModels?.cnt ?? 0}`);
  console.log(`  role 1/2/3 剩余:`, remainRole);
  console.log(`  订单: ${ordersLeft?.cnt ?? 0} 条`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
