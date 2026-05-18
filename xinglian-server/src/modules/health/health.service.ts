import { dbPool } from "../../config/db";

export async function getDbNow(): Promise<unknown> {
  const [rows] = await dbPool.query("SELECT NOW() AS now");
  return rows;
}
