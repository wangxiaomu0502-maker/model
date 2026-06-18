/**
 * 按 user_no 物理删除单个用户及关联数据
 * 用法：tsx scripts/purge-user-by-no.ts RvyAUVPi2gSx
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

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
  const userNo = process.argv[2]?.trim();
  if (!userNo) {
    console.error("用法: tsx scripts/purge-user-by-no.ts <user_no>");
    process.exit(1);
  }

  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = stripEnvQuotes(process.env.DB_PASSWORD);
  const database = process.env.DB_NAME ?? "xinglian";

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4"
  });

  const [users] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, user_no, role, nickname FROM users WHERE user_no = ? LIMIT 1`,
    [userNo]
  );
  if (users.length === 0) {
    console.log(`用户 ${userNo} 不存在，可能已删除。`);
    await conn.end();
    return;
  }

  const row = users[0];
  const uid = Number(row.id);
  const idParams = [uid];
  console.log(`待物理删除: id=${uid} user_no=${row.user_no} role=${row.role} ${row.nickname ?? ""}`);

  const orderMatchSql = `merchant_user_id = ? OR model_user_id = ? OR broker_user_id = ? OR agent_user_id = ?`;
  const orderMatchParams = [uid, uid, uid, uid];

  await conn.beginTransaction();
  try {
    await conn.query(`UPDATE users SET referrer_id = NULL WHERE referrer_id = ?`, idParams);
    await conn.query(`UPDATE users SET agent_user_id = NULL WHERE agent_user_id = ?`, idParams);

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
      await conn.query(`DELETE FROM user_account_ledger WHERE user_id = ?`, idParams);
      await conn.query(
        `DELETE l FROM user_account_ledger l
         INNER JOIN orders o ON o.id = l.order_id
         WHERE ${orderMatchSql}`,
        orderMatchParams
      );
    }

    if (await tableExists(conn, "user_account_balance")) {
      const [r] = await conn.query<mysql.ResultSetHeader>(
        `DELETE FROM user_account_balance WHERE user_id = ?`,
        idParams
      );
      if (r.affectedRows) console.log(`  user_account_balance: ${r.affectedRows}`);
    }

    const [orderDel] = await conn.query<mysql.ResultSetHeader>(
      `DELETE FROM orders WHERE ${orderMatchSql}`,
      orderMatchParams
    );
    if (orderDel.affectedRows) console.log(`  orders: ${orderDel.affectedRows}`);

    for (const table of [
      "model_profile_categories",
      "model_extra_data",
      "model_honors",
      "model_profiles",
      "merchant_profiles",
      "broker_profiles",
      "agent_profiles",
      "user_contract_snapshots"
    ]) {
      if (!(await tableExists(conn, table))) continue;
      const [r] = await conn.query<mysql.ResultSetHeader>(
        `DELETE FROM \`${table}\` WHERE user_id = ?`,
        idParams
      );
      if (r.affectedRows) console.log(`  ${table}: ${r.affectedRows}`);
    }

    const [userDel] = await conn.query<mysql.ResultSetHeader>(
      `DELETE FROM users WHERE id = ?`,
      idParams
    );
    console.log(`  users: ${userDel.affectedRows}`);

    await conn.commit();
    console.log("物理删除完成。");
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  const [check] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id FROM users WHERE user_no = ?`,
    [userNo]
  );
  console.log(`验证: users 中剩余 ${check.length} 条`);

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
