import mysql, { Pool, QueryOptions, QueryValues } from "mysql2/promise";

import { env } from "./env";

const RETRIABLE_DB_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "ECONNREFUSED"
]);

function isRetriableDbError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code != null && RETRIABLE_DB_CODES.has(code);
}

const rawPool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  /** 空闲连接超过 60s 回收，避免 MySQL wait_timeout 后复用失效连接 */
  idleTimeout: 60_000,
  maxIdle: env.db.connectionLimit,
  waitForConnections: true,
  /** 与表 utf8mb4 一致；配合下方 SET NAMES，避免 VARCHAR（如合同 title）按错误字符集解释 */
  charset: "utf8mb4",
  /** 业务按北京时间；与 `shanghai-calendar` rangeUtc、DATETIME 分账时间写入口径一致 */
  timezone: "+08:00"
});

rawPool.on("connection", (connection) => {
  void connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  connection.on("error", (error: NodeJS.ErrnoException) => {
    console.warn("[xinglian-server] mysql connection error:", error.code || error.message);
  });
});

const nativeQuery = rawPool.query.bind(rawPool);

async function queryWithRetry<T extends mysql.QueryResult>(
  sqlOrOptions: string | QueryOptions,
  values?: QueryValues
): Promise<[T, mysql.FieldPacket[]]> {
  try {
    if (typeof sqlOrOptions === "string") {
      return await nativeQuery<T>(sqlOrOptions, values);
    }
    return await nativeQuery<T>(sqlOrOptions);
  } catch (error) {
    if (!isRetriableDbError(error)) throw error;
    if (typeof sqlOrOptions === "string") {
      return await nativeQuery<T>(sqlOrOptions, values);
    }
    return await nativeQuery<T>(sqlOrOptions);
  }
}

/** query 遇断连/超时会自动重试一次；getConnection 等仍走原生 pool */
export const dbPool = rawPool as Pool & {
  query: typeof queryWithRetry;
};
dbPool.query = queryWithRetry;

export async function checkDbConnection(): Promise<void> {
  await dbPool.query("SELECT 1");
}
