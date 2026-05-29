import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type ModelHonorRow = RowDataPacket & {
  id: number;
  user_id: number;
  title: string;
  image_url: string | null;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export function rowToHonorDto(row: ModelHonorRow): {
  id: number;
  title: string;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: Number(row.id),
    title: String(row.title || "").trim(),
    imageUrl: row.image_url != null && String(row.image_url).trim() ? String(row.image_url).trim() : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export async function listModelHonorsByUserId(userId: number): Promise<ModelHonorRow[]> {
  const [rows] = await dbPool.query<ModelHonorRow[]>(
    `SELECT id, user_id, title, image_url, sort_order, created_at, updated_at
       FROM model_honors
      WHERE user_id = ?
      ORDER BY sort_order ASC, id ASC`,
    [userId]
  );
  return rows;
}

export async function findModelHonorByIdForUser(
  honorId: number,
  userId: number
): Promise<ModelHonorRow | null> {
  const [rows] = await dbPool.query<ModelHonorRow[]>(
    `SELECT id, user_id, title, image_url, sort_order, created_at, updated_at
       FROM model_honors
      WHERE id = ? AND user_id = ?
      LIMIT 1`,
    [honorId, userId]
  );
  return rows[0] ?? null;
}

export async function getNextHonorSortOrder(userId: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
       FROM model_honors
      WHERE user_id = ?`,
    [userId]
  );
  return Number(rows[0]?.next_sort ?? 0);
}

export async function insertModelHonor(input: {
  userId: number;
  title: string;
  imageUrl: string | null;
  sortOrder: number;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO model_honors (user_id, title, image_url, sort_order)
     VALUES (?, ?, ?, ?)`,
    [input.userId, input.title, input.imageUrl, input.sortOrder]
  );
  return Number(result.insertId);
}

export async function updateModelHonorForUser(
  honorId: number,
  userId: number,
  patch: { title?: string; imageUrl?: string | null; sortOrder?: number }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.imageUrl !== undefined) {
    sets.push("image_url = ?");
    params.push(patch.imageUrl);
  }
  if (patch.sortOrder !== undefined) {
    sets.push("sort_order = ?");
    params.push(patch.sortOrder);
  }
  if (!sets.length) return false;
  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(honorId, userId);
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE model_honors SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteModelHonorForUser(honorId: number, userId: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `DELETE FROM model_honors WHERE id = ? AND user_id = ?`,
    [honorId, userId]
  );
  return result.affectedRows > 0;
}
