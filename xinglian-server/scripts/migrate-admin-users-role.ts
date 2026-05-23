/**
 * 为 admin_users 增加 role 字段（admin / cs）
 * 须在 xinglian-server 目录执行：npm run migrate:admin-users-role
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

  if (!(await columnExists(conn, "admin_users", "role"))) {
    await conn.query(
      `ALTER TABLE admin_users
       ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin'
         COMMENT 'admin=管理员 cs=客服'
         AFTER username`
    );
    console.log("已添加 admin_users.role");
  } else {
    console.log("admin_users.role 已存在");
  }

  await conn.query(`UPDATE admin_users SET role = 'admin' WHERE role IS NULL OR role = ''`);

  try {
    await conn.query(`CREATE INDEX idx_admin_users_role ON admin_users (role)`);
    console.log("已创建索引 idx_admin_users_role");
  } catch (e) {
    const err = e as { code?: string };
    if (err.code !== "ER_DUP_KEYNAME") throw e;
  }

  await conn.end();
  console.log("migrate:admin-users-role 完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
