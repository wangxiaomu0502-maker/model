import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type CommercialShootRow = RowDataPacket & {
  id: number;
  name: string;
  province: string;
  city: string;
  district: string;
  detail_address: string;
  contact_name: string;
  contact_phone: string;
  price_range: string;
  description: string;
  image_urls: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const SELECT_COLUMNS = `
  id, name, province, city, district, detail_address, contact_name, contact_phone, price_range, description, image_urls, created_at, updated_at
`;

export async function countCommercialShoots(): Promise<number> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM commercial_shoots"
  );
  return Number(rows[0]?.total ?? 0);
}

export async function findCommercialShootsPage(
  offset: number,
  pageSize: number
): Promise<CommercialShootRow[]> {
  const [rows] = await dbPool.query<CommercialShootRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM commercial_shoots
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  return rows;
}

export async function findCommercialShootById(id: number): Promise<CommercialShootRow | null> {
  const [rows] = await dbPool.query<CommercialShootRow[]>(
    `SELECT ${SELECT_COLUMNS}
       FROM commercial_shoots
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertCommercialShoot(input: {
  name: string;
  province: string;
  city: string;
  district: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
  priceRange: string;
  description: string;
  imageUrls: string;
}): Promise<number> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `INSERT INTO commercial_shoots (
       name, province, city, district, detail_address, contact_name, contact_phone, price_range, description, image_urls
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.province,
      input.city,
      input.district,
      input.detailAddress,
      input.contactName,
      input.contactPhone,
      input.priceRange,
      input.description,
      input.imageUrls
    ]
  );
  return Number(result.insertId);
}

export async function updateCommercialShoot(
  id: number,
  patch: {
    name?: string;
    province?: string;
    city?: string;
    district?: string;
    detailAddress?: string;
    contactName?: string;
    contactPhone?: string;
    priceRange?: string;
    description?: string;
    imageUrls?: string;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.province !== undefined) add("province", patch.province);
  if (patch.city !== undefined) add("city", patch.city);
  if (patch.district !== undefined) add("district", patch.district);
  if (patch.detailAddress !== undefined) add("detail_address", patch.detailAddress);
  if (patch.contactName !== undefined) add("contact_name", patch.contactName);
  if (patch.contactPhone !== undefined) add("contact_phone", patch.contactPhone);
  if (patch.priceRange !== undefined) add("price_range", patch.priceRange);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.imageUrls !== undefined) add("image_urls", patch.imageUrls);
  if (!sets.length) return false;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE commercial_shoots SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteCommercialShoot(id: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `DELETE FROM commercial_shoots WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
