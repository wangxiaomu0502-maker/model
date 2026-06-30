import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type HomeBannerRow = RowDataPacket & {
  id: number;
  type: "image" | "video";
  sort_order: number;
  image_url: string | null;
  cover_url: string | null;
  video_url: string | null;
  enabled: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const SELECT_COLUMNS = `
  id, type, sort_order, image_url, cover_url, video_url, enabled, created_at, updated_at
`;

export async function countHomeBanners(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM home_banners");
  return Number(rows[0]?.total ?? 0);
}

export async function findHomeBannersPage(
  offset: number,
  pageSize: number
): Promise<HomeBannerRow[]> {
  const [rows] = await dbPool.query<HomeBannerRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM home_banners
      ORDER BY sort_order ASC, id ASC
      LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  return rows;
}

export async function findEnabledHomeBanners(): Promise<HomeBannerRow[]> {
  const [rows] = await dbPool.query<HomeBannerRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM home_banners
      WHERE enabled = 1
      ORDER BY sort_order ASC, id ASC`
  );
  return rows;
}

export async function findHomeBannerById(id: number): Promise<HomeBannerRow | null> {
  const [rows] = await dbPool.query<HomeBannerRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM home_banners
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertHomeBanner(input: {
  type: "image" | "video";
  sortOrder: number;
  imageUrl: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  enabled: boolean;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO home_banners (type, sort_order, image_url, cover_url, video_url, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.type,
      input.sortOrder,
      input.imageUrl,
      input.coverUrl,
      input.videoUrl,
      input.enabled ? 1 : 0
    ]
  );
  return Number(result.insertId);
}

export async function updateHomeBanner(
  id: number,
  patch: {
    type?: "image" | "video";
    sortOrder?: number;
    imageUrl?: string | null;
    coverUrl?: string | null;
    videoUrl?: string | null;
    enabled?: boolean;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.type !== undefined) add("type", patch.type);
  if (patch.sortOrder !== undefined) add("sort_order", patch.sortOrder);
  if (patch.imageUrl !== undefined) add("image_url", patch.imageUrl);
  if (patch.coverUrl !== undefined) add("cover_url", patch.coverUrl);
  if (patch.videoUrl !== undefined) add("video_url", patch.videoUrl);
  if (patch.enabled !== undefined) add("enabled", patch.enabled ? 1 : 0);
  if (!sets.length) return false;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE home_banners SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteHomeBanner(id: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(`DELETE FROM home_banners WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}
