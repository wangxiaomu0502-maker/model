import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export const MERCHANT_ORDER_ENABLED_KEY = "merchant_order_enabled";
export const HOME_STAT_MODEL_OFFSET_KEY = "home_stat_model_offset";
export const HOME_STAT_BROKER_OFFSET_KEY = "home_stat_broker_offset";
export const HOME_STAT_MERCHANT_OFFSET_KEY = "home_stat_merchant_offset";

export type SystemSettingRow = RowDataPacket & {
  setting_key: string;
  setting_value: string;
  updated_at: Date;
};

export async function ensureSystemSettingsTable(): Promise<void> {
  await dbPool.query(
    `CREATE TABLE IF NOT EXISTS platform_system_settings (
       setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
       setting_value VARCHAR(255) NOT NULL,
       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function findSystemSetting(key: string): Promise<SystemSettingRow | null> {
  await ensureSystemSettingsTable();
  const [rows] = await dbPool.query<SystemSettingRow[]>(
    `SELECT setting_key, setting_value, updated_at
     FROM platform_system_settings
     WHERE setting_key = ?
     LIMIT 1`,
    [key]
  );
  return rows[0] ?? null;
}

export async function findSystemSettings(keys: string[]): Promise<Map<string, SystemSettingRow>> {
  await ensureSystemSettingsTable();
  if (keys.length === 0) return new Map();
  const [rows] = await dbPool.query<SystemSettingRow[]>(
    `SELECT setting_key, setting_value, updated_at
     FROM platform_system_settings
     WHERE setting_key IN (?)`,
    [keys]
  );
  return new Map(rows.map((row) => [row.setting_key, row]));
}

export async function upsertSystemSetting(key: string, value: string): Promise<boolean> {
  await ensureSystemSettingsTable();
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO platform_system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                             updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
  return result.affectedRows > 0;
}
