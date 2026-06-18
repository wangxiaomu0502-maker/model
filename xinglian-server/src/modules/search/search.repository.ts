import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type SearchUserRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  role: number;
  city: string | null;
  real_name: string | null;
  is_professional: number | string | null;
};

export type BrokerPublicDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  broker_real_name: string | null;
  broker_is_professional: number | string | null;
  bound_merchant_count: number | string | null;
  created_at: Date | string;
};

export type MerchantPublicDetailRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  city: string | null;
  referrer_broker_user_no: string | null;
  referrer_broker_nickname: string | null;
  referrer_broker_real_name: string | null;
  created_at: Date | string;
};

function keywordClause(keyword: string): { sql: string; params: string[] } {
  const kw = keyword.trim();
  if (!kw) {
    return { sql: " AND 1=0", params: [] };
  }
  const like = `%${kw}%`;
  return {
    sql: ` AND (
      u.nickname LIKE ?
      OR u.user_no LIKE ?
      OR COALESCE(u.real_name, '') LIKE ?
      OR COALESCE(bp.real_name, '') LIKE ?
    )`,
    params: [like, like, like, like]
  };
}

export async function searchPublicUsers(keyword: string, limit: number): Promise<SearchUserRow[]> {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const kw = keywordClause(keyword);
  const [rows] = await dbPool.query<SearchUserRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.role,
            NULLIF(TRIM(COALESCE(mprof.city, mp.city, '')), '') AS city,
            NULLIF(TRIM(COALESCE(bp.real_name, u.real_name, '')), '') AS real_name,
            bp.is_professional
     FROM users u
     LEFT JOIN model_profiles mprof ON mprof.user_id = u.id AND u.role = 1
     LEFT JOIN merchant_profiles mp ON mp.user_id = u.id AND u.role = 2
     LEFT JOIN broker_profiles bp ON bp.user_id = u.id AND u.role = 3
     WHERE u.deleted_at IS NULL
       AND u.role IN (1, 2, 3)
       AND u.status = 1
       ${kw.sql}
     ORDER BY FIELD(u.role, 1, 3, 2), u.id DESC
     LIMIT ?`,
    [...kw.params, safeLimit]
  );
  return rows;
}

export async function findBrokerPublicDetailByUserNo(
  userNo: string
): Promise<BrokerPublicDetailRow | null> {
  const key = String(userNo || "").trim();
  if (!key) return null;
  const [rows] = await dbPool.query<BrokerPublicDetailRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url,
            bp.real_name AS broker_real_name,
            bp.is_professional AS broker_is_professional,
            (SELECT COUNT(*) FROM users ub
             WHERE ub.deleted_at IS NULL AND ub.role = 2 AND ub.referrer_id = u.id) AS bound_merchant_count,
            u.created_at
     FROM users u
     LEFT JOIN broker_profiles bp ON bp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 3
       AND u.status = 1
       AND u.user_no = ?
     LIMIT 1`,
    [key]
  );
  return rows[0] ?? null;
}

export async function findMerchantPublicDetailByUserNo(
  userNo: string
): Promise<MerchantPublicDetailRow | null> {
  const key = String(userNo || "").trim();
  if (!key) return null;
  const [rows] = await dbPool.query<MerchantPublicDetailRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url,
            mp.city,
            ref.user_no AS referrer_broker_user_no,
            ref.nickname AS referrer_broker_nickname,
            bref.real_name AS referrer_broker_real_name,
            u.created_at
     FROM users u
     LEFT JOIN merchant_profiles mp ON mp.user_id = u.id
     LEFT JOIN users ref ON ref.id = u.referrer_id AND ref.deleted_at IS NULL AND ref.role = 3
     LEFT JOIN broker_profiles bref ON bref.user_id = ref.id
     WHERE u.deleted_at IS NULL
       AND u.role = 2
       AND u.status = 1
       AND u.user_no = ?
     LIMIT 1`,
    [key]
  );
  return rows[0] ?? null;
}
