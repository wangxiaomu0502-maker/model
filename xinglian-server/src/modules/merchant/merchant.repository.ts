import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

type MerchantProfileRow = RowDataPacket & {
  user_id: number;
  city: string | null;
};

export async function ensureMerchantProfile(userId: number): Promise<void> {
  await dbPool.query(
    `INSERT INTO merchant_profiles (user_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId]
  );
}

export async function findMerchantProfileByUserId(userId: number): Promise<MerchantProfileRow | null> {
  const [rows] = await dbPool.query<MerchantProfileRow[]>(
    "SELECT user_id, city FROM merchant_profiles WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateMerchantCity(userId: number, city: string): Promise<void> {
  await dbPool.query(
    `UPDATE merchant_profiles
     SET city = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [city, userId]
  );
}

export async function updateMerchantProfileAuditStatus(userId: number, status: number): Promise<void> {
  await dbPool.query(
    `UPDATE users
     SET profile_audit_status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = 2`,
    [status, userId]
  );
}

