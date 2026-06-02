/**
 * 删除所有 mock 模特(role=1 且 is_mock=1)及其关联数据。
 *
 * 执行：在 xinglian-server 目录
 *   npm run purge:mock-models -- --dry-run
 *   npm run purge:mock-models
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

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function deleteFromTableByUserIds(
  conn: mysql.Connection,
  table: string,
  userIds: number[],
  idPlaceholders: string
): Promise<void> {
  if (!(await tableExists(conn, table))) return;
  await conn.query(`DELETE FROM \`${table}\` WHERE user_id IN (${idPlaceholders})`, userIds);
}

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

  const [toPurge] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT u.id, u.user_no, u.nickname
     FROM users u
     WHERE u.role = 1 AND COALESCE(u.is_mock, 0) = 1 AND u.deleted_at IS NULL
     ORDER BY u.id`
  );

  const purgeIds = toPurge.map((r) => Number(r.id));
  console.log(`待删除 mock 模特 ${purgeIds.length} 个：`);
  for (const row of toPurge.slice(0, 50)) {
    console.log(`  - ${row.user_no} id=${row.id} ${row.nickname ?? ""}`);
  }
  if (toPurge.length > 50) {
    console.log(`  ... 另有 ${toPurge.length - 50} 条`);
  }

  if (purgeIds.length === 0) {
    console.log("\n无需清理。");
    await conn.end();
    return;
  }

  const idPlaceholders = purgeIds.map(() => "?").join(",");
  const idParams = [...purgeIds];
  const orderMatchSql = `model_user_id IN (${idPlaceholders})`;

  if (dryRun) {
    const [[orderCnt]] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM orders WHERE ${orderMatchSql}`,
      idParams
    );
    console.log(`\n[dry-run] 将删除相关订单约 ${orderCnt?.cnt ?? 0} 条`);
    console.log("[dry-run] 将删除 mock 模特的模卡、作品、档期、荣誉、合同快照、钱包余额/流水等关联数据");
    await conn.end();
    return;
  }

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
        idParams
      );
    }

    if (await tableExists(conn, "payment_operation_logs")) {
      await conn.query(
        `DELETE p FROM payment_operation_logs p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE ${orderMatchSql}`,
        idParams
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
        idParams
      );
    }

    await deleteFromTableByUserIds(conn, "user_account_balance", idParams, idPlaceholders);
    await conn.query(`DELETE FROM orders WHERE ${orderMatchSql}`, idParams);
    await deleteFromTableByUserIds(conn, "model_profile_categories", idParams, idPlaceholders);
    await deleteFromTableByUserIds(conn, "model_honors", idParams, idPlaceholders);
    await deleteFromTableByUserIds(conn, "model_extra_data", idParams, idPlaceholders);
    await deleteFromTableByUserIds(conn, "model_profiles", idParams, idPlaceholders);
    await deleteFromTableByUserIds(conn, "user_contract_snapshots", idParams, idPlaceholders);
    await conn.query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, idParams);

    await conn.commit();
    console.log("\n已提交 mock 模特清理。");
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  const [[mockModels]] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM users WHERE role = 1 AND COALESCE(is_mock, 0) = 1 AND deleted_at IS NULL"
  );
  const [[ordersLeft]] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM orders WHERE ${orderMatchSql}`,
    idParams
  );

  await conn.end();

  console.log("\n清理后统计：");
  console.log(`  mock 模特: ${mockModels?.cnt ?? 0}`);
  console.log(`  相关订单: ${ordersLeft?.cnt ?? 0} 条`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
