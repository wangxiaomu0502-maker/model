import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

type ModelProfileRow = RowDataPacket & {
  user_id: number;
  phone: string | null;
  stage_name: string | null;
  gender: number | null;
  birth_date: string | null;
  city: string | null;
  intro: string | null;
  height: number | null;
  weight: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  shoe_size: string | null;
  hair_color: string | null;
  skin_tone: string | null;
  price_hour: number | null;
  price_halfday: number | null;
  price_allday: number | null;
  is_available: number;
  only_local_orders: number;
  only_female_clients: number;
};

type ModelExtraRow = RowDataPacket & {
  user_id: number;
  card_json: string | null;
  portfolio_json: string | null;
  style_position_json: string | null;
  schedule_json: string | null;
  order_settings_json: string | null;
};

type CategoryNodeRow = RowDataPacket & {
  id: number;
  parent_id: number | null;
  type: "main" | "style" | "scene";
  name: string;
  sort_order: number;
};

type CategoryRelRow = RowDataPacket & {
  category_id: number;
};

type MerchantModelListRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  city: string | null;
  profile_gender: number | null;
  intro: string | null;
  price_hour: number | null;
  price_halfday: number | null;
  price_allday: number | null;
  rating_score: number | string | null;
  is_available: number;
  profile_audit_status: number;
  category_ids: string | null;
  category_names: string | null;
  card_json: string | Buffer | null;
};

export type MerchantModelListFilters = {
  province?: string;
  city?: string;
  gender?: "男" | "女";
  categoryId?: number;
  categoryIds?: number[];
  category?: string;
  priceSort?: "asc" | "desc";
  ratingSort?: "desc";
  limit?: number;
};

let modelRatingScoreColumnExists: boolean | null = null;

async function hasModelRatingScoreColumn(): Promise<boolean> {
  if (modelRatingScoreColumnExists != null) return modelRatingScoreColumnExists;
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'model_profiles'
       AND COLUMN_NAME = 'rating_score'`
  );
  modelRatingScoreColumnExists = Number(rows[0]?.cnt || 0) > 0;
  return modelRatingScoreColumnExists;
}

type PublicModelDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  city: string | null;
  intro: string | null;
  height: number | null;
  weight: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  profile_gender: number | null;
  price_hour: number | null;
  price_halfday: number | null;
  price_allday: number | null;
  is_available: number;
  profile_audit_status: number;
  only_local_orders: number;
  only_female_clients: number;
  card_json: string | null;
  portfolio_json: string | null;
  style_position_json: string | null;
  order_settings_json: string | null;
  schedule_json: string | null;
};

const publicModelDetailSelect = `SELECT u.id,
            u.user_no,
            u.nickname,
            u.avatar_url,
            u.profile_audit_status,
            mp.city,
            mp.intro,
            mp.height,
            mp.weight,
            mp.bust,
            mp.waist,
            mp.hip,
            mp.gender AS profile_gender,
            mp.price_hour,
            mp.price_halfday,
            mp.price_allday,
            mp.is_available,
            mp.only_local_orders,
            mp.only_female_clients,
            mex.card_json,
            mex.portfolio_json,
            mex.style_position_json,
            mex.order_settings_json,
            mex.schedule_json
     FROM users u
     INNER JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN model_extra_data mex ON mex.user_id = u.id
     WHERE u.role = 1
       AND u.status = 1
       AND mp.is_available = 1`;

export async function ensureModelProfile(userId: number): Promise<void> {
  await dbPool.query(
    `INSERT INTO model_profiles (user_id, is_available, only_local_orders, only_female_clients)
     VALUES (?, 0, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId]
  );
}

export async function findModelProfile(userId: number): Promise<ModelProfileRow | null> {
  const [rows] = await dbPool.query<ModelProfileRow[]>(
    `SELECT mp.*, u.phone
     FROM model_profiles mp
     LEFT JOIN users u ON u.id = mp.user_id
     WHERE mp.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function ensureModelExtra(userId: number): Promise<void> {
  await dbPool.query(
    `INSERT INTO model_extra_data (user_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId]
  );
}

export async function findModelExtra(userId: number): Promise<ModelExtraRow | null> {
  const [rows] = await dbPool.query<ModelExtraRow[]>(
    "SELECT * FROM model_extra_data WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateBasicInfo(userId: number, data: Record<string, unknown>): Promise<void> {
  await dbPool.query(
    `UPDATE model_profiles
     SET stage_name = ?,
         gender = ?,
         birth_date = ?,
         city = ?,
         intro = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      data.name ?? null,
      data.gender === "男" ? 1 : data.gender === "女" ? 2 : 0,
      data.birthDate ?? null,
      data.city ?? null,
      data.intro ?? null,
      userId
    ]
  );
}

/** 保存模卡时同步形体参数到 model_profiles，便于列表/统计查询 */
export async function syncModelProfileFromCard(
  userId: number,
  payload: {
    measurements?: Record<string, unknown>;
    hairColor?: unknown;
    skinColor?: unknown;
  }
): Promise<void> {
  const m = payload.measurements || {};
  const shoeRaw = m.shoeSize;
  const shoeSize =
    shoeRaw != null && String(shoeRaw).trim() !== "" ? String(shoeRaw).trim() : null;
  await dbPool.query(
    `UPDATE model_profiles
     SET height = ?,
         weight = ?,
         bust = ?,
         waist = ?,
         hip = ?,
         shoe_size = ?,
         hair_color = ?,
         skin_tone = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      m.height ?? null,
      m.weight ?? null,
      m.bust ?? null,
      m.waist ?? null,
      m.hip ?? null,
      shoeSize,
      payload.hairColor != null ? String(payload.hairColor).trim() || null : null,
      payload.skinColor != null ? String(payload.skinColor).trim() || null : null,
      userId
    ]
  );
}

export async function updateUserPhone(userId: number, phone: string | null): Promise<void> {
  await dbPool.query(
    "UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [phone, userId]
  );
}

export async function updatePricing(userId: number, data: Record<string, unknown>): Promise<void> {
  await dbPool.query(
    `UPDATE model_profiles
     SET price_hour = ?,
         price_halfday = ?,
         price_allday = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [data.hourly ?? null, data.halfDay ?? null, data.fullDay ?? null, userId]
  );
}

export async function updateOrderSettings(userId: number, settings: Record<string, unknown>): Promise<void> {
  const s = settings as Record<string, unknown>;
  await dbPool.query(
    `UPDATE model_profiles
     SET is_available = ?,
         only_local_orders = ?,
         only_female_clients = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      s.orderEnabled ? 1 : 0,
      s.onlyLocal ? 1 : 0,
      s.onlyFemale ? 1 : 0,
      userId
    ]
  );

  await dbPool.query(
    `UPDATE model_extra_data
     SET order_settings_json = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [JSON.stringify({ settings }), userId]
  );
}

export async function updateExtraJson(
  userId: number,
  column: "card_json" | "portfolio_json" | "style_position_json" | "schedule_json",
  payload: unknown
): Promise<void> {
  await dbPool.query(
    `UPDATE model_extra_data
     SET ${column} = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [JSON.stringify(payload), userId]
  );
}

export async function findCategoryTreeRows(): Promise<CategoryNodeRow[]> {
  const [rows] = await dbPool.query<CategoryNodeRow[]>(
    `SELECT id, parent_id, type, name, sort_order
     FROM model_category_nodes
     WHERE is_enabled = 1
     ORDER BY type ASC, parent_id ASC, sort_order ASC, id ASC`
  );
  return rows;
}

export async function findMyCategoryIds(userId: number): Promise<number[]> {
  const [rows] = await dbPool.query<CategoryRelRow[]>(
    `SELECT category_id
     FROM model_profile_categories
     WHERE user_id = ?
     ORDER BY category_id ASC`,
    [userId]
  );
  return rows.map((row) => row.category_id);
}

export async function ensureLeafCategoryIds(categoryIds: number[]): Promise<void> {
  if (!categoryIds.length) return;
  const placeholders = categoryIds.map(() => "?").join(",");
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT id
     FROM model_category_nodes
     WHERE id IN (${placeholders}) AND is_leaf = 1 AND is_enabled = 1`,
    categoryIds
  );
  if (rows.length !== categoryIds.length) {
    throw new AppError("存在无效分类ID", 400, ErrorCodes.VALIDATION_ERROR);
  }
}

export async function replaceMyCategoryIds(userId: number, categoryIds: number[]): Promise<void> {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM model_profile_categories WHERE user_id = ?", [userId]);
    for (const categoryId of categoryIds) {
      await connection.query(
        `INSERT INTO model_profile_categories (user_id, category_id)
         VALUES (?, ?)`,
        [userId, categoryId]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findMerchantModelList(filters: MerchantModelListFilters = {}): Promise<MerchantModelListRow[]> {
  const safeLimit = Math.max(1, Math.min(100, Number(filters.limit) || 50));
  const where: string[] = [
    "u.role = 1",
    "u.status = 1",
    "u.deleted_at IS NULL",
    "u.profile_audit_status = 2",
    "mp.is_available = 1"
  ];
  const params: Array<string | number> = [];
  const province = filters.province ? String(filters.province).trim() : "";
  const city = filters.city ? String(filters.city).trim() : "";
  const category = filters.category ? String(filters.category).trim() : "";
  if (province && city) {
    where.push("(mp.city = ? OR mp.city = ?)");
    params.push(`${province} ${city}`, city);
  } else if (province) {
    where.push("mp.city LIKE ?");
    params.push(`${province}%`);
  } else if (city) {
    where.push("mp.city = ?");
    params.push(city);
  }
  if (filters.gender === "男" || filters.gender === "女") {
    where.push("mp.gender = ?");
    params.push(filters.gender === "男" ? 1 : 2);
  }
  const categoryIds = (filters.categoryIds || []).filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (categoryIds.length > 0) {
    const placeholders = categoryIds.map(() => "?").join(",");
    where.push(
      `EXISTS (
         SELECT 1
         FROM model_profile_categories pc_filter
         WHERE pc_filter.user_id = u.id AND pc_filter.category_id IN (${placeholders})
       )`
    );
    params.push(...categoryIds);
  } else if (filters.categoryId && Number.isInteger(filters.categoryId) && filters.categoryId > 0) {
    where.push(
      `EXISTS (
         SELECT 1
         FROM model_profile_categories pc_filter
         WHERE pc_filter.user_id = u.id AND pc_filter.category_id = ?
       )`
    );
    params.push(filters.categoryId);
  } else if (category) {
    where.push(
      `EXISTS (
         SELECT 1
         FROM model_profile_categories pc_filter
         INNER JOIN model_category_nodes n_filter ON n_filter.id = pc_filter.category_id
         WHERE pc_filter.user_id = u.id AND n_filter.name = ?
       )`
    );
    params.push(category);
  }
  const ratingExpr = (await hasModelRatingScoreColumn()) ? "COALESCE(mp.rating_score, 5.0)" : "5.0";
  const orderParts: string[] = [];
  if (filters.ratingSort === "desc") {
    orderParts.push("rating_score DESC");
  }
  if (filters.priceSort === "asc") {
    orderParts.push("mp.price_hour IS NULL ASC", "mp.price_hour ASC");
  } else if (filters.priceSort === "desc") {
    orderParts.push("mp.price_hour IS NULL ASC", "mp.price_hour DESC");
  }
  orderParts.push("u.created_at DESC", "u.id DESC");
  const [rows] = await dbPool.query<MerchantModelListRow[]>(
    `SELECT u.id,
            u.user_no,
            u.nickname,
            u.avatar_url,
            mp.city,
            mp.gender AS profile_gender,
            mp.intro,
            mp.price_hour,
            mp.price_halfday,
            mp.price_allday,
            ${ratingExpr} AS rating_score,
            mp.is_available,
            u.profile_audit_status,
            GROUP_CONCAT(DISTINCT n.id ORDER BY n.sort_order ASC, n.id ASC SEPARATOR ',') AS category_ids,
            GROUP_CONCAT(DISTINCT n.name ORDER BY n.sort_order ASC, n.id ASC SEPARATOR ',') AS category_names,
            MAX(mex.card_json) AS card_json
     FROM users u
     LEFT JOIN model_profiles mp ON mp.user_id = u.id
     LEFT JOIN model_extra_data mex ON mex.user_id = u.id
     LEFT JOIN model_profile_categories pc ON pc.user_id = u.id
     LEFT JOIN model_category_nodes n ON n.id = pc.category_id
     WHERE ${where.join("\n       AND ")}
     GROUP BY u.id,
              u.user_no,
              u.nickname,
              u.avatar_url,
              mp.city,
              mp.gender,
              mp.intro,
              mp.price_hour,
              mp.price_halfday,
              mp.price_allday,
              rating_score,
              mp.is_available,
              u.profile_audit_status
     ORDER BY ${orderParts.join(",\n              ")}
     LIMIT ?`,
    [...params, safeLimit]
  );
  return rows;
}

export async function findPublicModelDetailByUserNo(userNo: string): Promise<PublicModelDetailRow | null> {
  const [rows] = await dbPool.query<PublicModelDetailRow[]>(
    `${publicModelDetailSelect}
       AND u.user_no = ?
     LIMIT 1`,
    [userNo]
  );
  return rows[0] ?? null;
}

export async function findPublicModelDetailByUserId(userId: number): Promise<PublicModelDetailRow | null> {
  const [rows] = await dbPool.query<PublicModelDetailRow[]>(
    `${publicModelDetailSelect}
       AND u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

/** 模特资料提审：仅允许待提交(0)、审核失败(3) → 审核中(1)，并清空驳回说明 */
export async function trySetModelProfileAuditPending(userId: number): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE users
     SET profile_audit_status = 1,
         profile_audit_reject_reason = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND role = 1 AND profile_audit_status IN (0, 3)`,
    [userId]
  );
  return result.affectedRows > 0;
}
