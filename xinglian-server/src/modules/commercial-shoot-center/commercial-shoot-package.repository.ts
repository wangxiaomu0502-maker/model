import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type CommercialShootPackageRow = RowDataPacket & {
  id: number;
  shoot_id: number;
  name: string;
  fee: string;
  list_price: string;
  remark: string | null;
  cover_url: string;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const SELECT_COLUMNS = `
  id, shoot_id, name, fee, list_price, remark, cover_url, sort_order, created_at, updated_at
`;

export async function countCommercialShootPackagesByShootId(shootId: number): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM commercial_shoot_packages WHERE shoot_id = ?",
    [shootId]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function findCommercialShootPackagesByShootIdPage(
  shootId: number,
  offset: number,
  pageSize: number
): Promise<CommercialShootPackageRow[]> {
  const [rows] = await dbPool.query<CommercialShootPackageRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM commercial_shoot_packages
      WHERE shoot_id = ?
      ORDER BY sort_order ASC, id ASC
      LIMIT ? OFFSET ?`,
    [shootId, pageSize, offset]
  );
  return rows;
}

export async function findCommercialShootPackagesByShootIds(
  shootIds: number[]
): Promise<CommercialShootPackageRow[]> {
  if (!shootIds.length) return [];
  const placeholders = shootIds.map(() => "?").join(", ");
  const [rows] = await dbPool.query<CommercialShootPackageRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM commercial_shoot_packages
      WHERE shoot_id IN (${placeholders})
      ORDER BY sort_order ASC, id ASC`,
    shootIds
  );
  return rows;
}

export async function countCommercialShootPackagesByShootIds(
  shootIds: number[]
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!shootIds.length) return counts;
  const placeholders = shootIds.map(() => "?").join(", ");
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT shoot_id, COUNT(*) AS total
       FROM commercial_shoot_packages
      WHERE shoot_id IN (${placeholders})
      GROUP BY shoot_id`,
    shootIds
  );
  for (const row of rows) {
    counts.set(Number(row.shoot_id), Number(row.total ?? 0));
  }
  return counts;
}

export async function findCommercialShootPackageById(
  id: number
): Promise<CommercialShootPackageRow | null> {
  const [rows] = await dbPool.query<CommercialShootPackageRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM commercial_shoot_packages
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertCommercialShootPackage(input: {
  shootId: number;
  name: string;
  fee: string;
  listPrice: string;
  remark: string | null;
  coverUrl: string;
  sortOrder: number;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO commercial_shoot_packages (shoot_id, name, fee, list_price, remark, cover_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.shootId, input.name, input.fee, input.listPrice, input.remark, input.coverUrl, input.sortOrder]
  );
  return Number(result.insertId);
}

export async function updateCommercialShootPackage(
  id: number,
  patch: {
    name?: string;
    fee?: string;
    listPrice?: string;
    remark?: string | null;
    coverUrl?: string;
    sortOrder?: number;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.fee !== undefined) add("fee", patch.fee);
  if (patch.listPrice !== undefined) add("list_price", patch.listPrice);
  if (patch.remark !== undefined) add("remark", patch.remark);
  if (patch.coverUrl !== undefined) add("cover_url", patch.coverUrl);
  if (patch.sortOrder !== undefined) add("sort_order", patch.sortOrder);
  if (!sets.length) return false;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE commercial_shoot_packages SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteCommercialShootPackage(id: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `DELETE FROM commercial_shoot_packages WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
