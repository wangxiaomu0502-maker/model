/**
 * 客服订单字段 + order_cs_notes 表
 * 须在 xinglian-server 目录执行：npm run migrate:orders-cs
 */
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";

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

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    charset: "utf8mb4",
    multipleStatements: true
  });

  if (!(await columnExists(conn, "orders", "cs_status"))) {
    await conn.query(`
      ALTER TABLE orders
        ADD COLUMN cs_status TINYINT UNSIGNED NULL DEFAULT NULL
          COMMENT 'NULL=未进客服队列 1待处理 2处理中 3已完成'
          AFTER remark,
        ADD COLUMN cs_queued_at DATETIME NULL COMMENT '进入客服队列时间'
          AFTER cs_status,
        ADD COLUMN cs_started_at DATETIME NULL COMMENT '客服开始处理时间'
          AFTER cs_queued_at,
        ADD COLUMN cs_completed_at DATETIME NULL COMMENT '客服处理完成时间'
          AFTER cs_started_at,
        ADD COLUMN cs_handler_admin_id BIGINT UNSIGNED NULL COMMENT '处理客服 admin_users.id'
          AFTER cs_completed_at
    `);
    console.log("已添加 orders.cs_* 字段");
  } else {
    console.log("orders.cs_status 已存在");
  }

  try {
    await conn.query(`CREATE INDEX idx_orders_cs_status ON orders (cs_status, cs_queued_at DESC)`);
    console.log("已创建索引 idx_orders_cs_status");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code !== "ER_DUP_KEYNAME") throw e;
  }

  if (!(await tableExists(conn, "order_cs_notes"))) {
    await conn.query(`
      CREATE TABLE order_cs_notes (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL COMMENT 'orders.id',
        admin_user_id BIGINT UNSIGNED NOT NULL COMMENT 'admin_users.id',
        content VARCHAR(2000) NOT NULL COMMENT '备注内容',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_order_cs_notes_order (order_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服订单备注'
    `);
    console.log("已创建 order_cs_notes 表");
  } else {
    console.log("order_cs_notes 已存在");
  }

  const [backfill] = await conn.query<mysql.ResultSetHeader>(
    `UPDATE orders
     SET cs_status = 1,
         cs_queued_at = COALESCE(cs_queued_at, updated_at, created_at)
     WHERE order_status IN (2, 3, 4)
       AND cs_status IS NULL`
  );
  console.log(`历史订单补队列：${backfill.affectedRows ?? 0} 条`);

  await conn.end();
  console.log("migrate:orders-cs 完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
