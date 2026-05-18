import mysql from "mysql2/promise";

import { env } from "./env";

export const dbPool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  /** 与表 utf8mb4 一致；配合下方 SET NAMES，避免 VARCHAR（如合同 title）按错误字符集解释 */
  charset: "utf8mb4",
  /** 业务按北京时间；与 `shanghai-calendar` rangeUtc、DATETIME 分账时间写入口径一致 */
  timezone: "+08:00"
});

dbPool.on("connection", (connection) => {
  void connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

export async function checkDbConnection(): Promise<void> {
  await dbPool.query("SELECT 1");
}
