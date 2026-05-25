import { RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type BrokerBoundMerchantRow = RowDataPacket & {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  contract_platform_merchant_signed_at: Date | string | null;
  city: string | null;
  created_at: Date | string;
};

function keywordClause(keyword: string | undefined): { sql: string; params: string[] } {
  const kw = (keyword ?? "").trim();
  if (!kw) {
    return { sql: "", params: [] };
  }
  const like = `%${kw}%`;
  return {
    sql: " AND (u.nickname LIKE ? OR u.user_no LIKE ?)",
    params: [like, like]
  };
}

export async function countBoundMerchantsForBroker(
  brokerUserId: number,
  keyword?: string
): Promise<number> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return 0;
  const kw = keywordClause(keyword);
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users u
     WHERE u.deleted_at IS NULL AND u.role = 2 AND u.referrer_id = ?${kw.sql}`,
    [bid, ...kw.params]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function findBoundMerchantsPageForBroker(
  brokerUserId: number,
  offset: number,
  limit: number,
  keyword?: string
): Promise<BrokerBoundMerchantRow[]> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) return [];
  const safeLimit = Math.max(1, Math.min(50, limit));
  const safeOffset = Math.max(0, offset);
  const kw = keywordClause(keyword);
  const [rows] = await dbPool.query<BrokerBoundMerchantRow[]>(
    `SELECT u.id, u.user_no, u.nickname, u.avatar_url, u.phone, u.status,
            u.verified_status, u.profile_audit_status,
            u.contract_platform_merchant_signed_at,
            mp.city,
            u.created_at
     FROM users u
     LEFT JOIN merchant_profiles mp ON mp.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND u.role = 2
       AND u.referrer_id = ?${kw.sql}
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [bid, ...kw.params, safeLimit, safeOffset]
  );
  return rows;
}
