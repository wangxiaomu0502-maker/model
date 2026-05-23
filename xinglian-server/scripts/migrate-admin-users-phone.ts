/**
 * admin_users 增加 phone 字段
 * 须在 xinglian-server 目录执行：npm run migrate:admin-users-phone
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

async function main(): Promise<void> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    charset: "utf8mb4"
  });

  if (!(await columnExists(conn, "admin_users", "phone"))) {
    await conn.query(
      `ALTER TABLE admin_users
       ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL
         COMMENT '联系电话'
         AFTER display_name`
    );
    console.log("已添加 admin_users.phone");
  } else {
    console.log("admin_users.phone 已存在");
  }

  await conn.end();
  console.log("migrate:admin-users-phone 完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
