/**
 * 分账 v2 冒烟：种子用户 → 两笔订单（有/无代理人）→ 商家确认完成 → 分账预览与执行
 * 在 xinglian-server 目录：npm run smoke:split-v2
 */
import path from "path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const BASE = process.env.SMOKE_API_BASE ?? "http://localhost:3000";
const ADMIN_USER = process.env.SMOKE_ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS ?? "xinglian@2026";

/** user_no 列长度有限，使用短前缀 */
const TAG = "S2";

type Preview = {
  orderNo: string;
  amountsYuan: {
    platformFee: number;
    modelIncome: number;
    brokerIncome: number;
    agentIncome: number;
  };
  brokerUserId: number | null;
  agentUserId: number | null;
};

async function adminLogin(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
  });
  const data = (await res.json()) as { ok?: boolean; token?: string; message?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.message || `admin login failed (${res.status})`);
  }
  return data.token;
}

async function adminFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const data = (await res.json()) as T & { ok?: boolean; message?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `request failed ${path} (${res.status})`);
  }
  return data;
}

async function seedUsers(conn: mysql.Connection): Promise<{
  brokerId: number;
  agentId: number;
  merchantId: number;
  modelWithAgentId: number;
  modelNoAgentId: number;
}> {
  const [existing] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, user_no FROM users WHERE user_no LIKE ? AND deleted_at IS NULL`,
    [`${TAG}%`]
  );
  const byNo = new Map(existing.map((r) => [String(r.user_no), Number(r.id)]));

  async function ensureUser(
    userNo: string,
    role: number,
    extra: { referrer_id?: number | null; agent_user_id?: number | null } = {}
  ): Promise<number> {
    const found = byNo.get(userNo);
    if (found) return found;
    const [r] = await conn.query<mysql.ResultSetHeader>(
      `INSERT INTO users (user_no, openid, role, nickname, status, referrer_id, agent_user_id)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [
        userNo,
        `openid_${userNo}`,
        role,
        userNo,
        extra.referrer_id ?? null,
        extra.agent_user_id ?? null
      ]
    );
    const id = Number(r.insertId);
    byNo.set(userNo, id);
    return id;
  }

  const brokerId = await ensureUser(`${TAG}BRK`, 3);
  const agentId = await ensureUser(`${TAG}AGT`, 4);
  const merchantId = await ensureUser(`${TAG}MCH`, 2, { referrer_id: brokerId });
  const modelWithAgentId = await ensureUser(`${TAG}MDA`, 1, { agent_user_id: agentId });
  const modelNoAgentId = await ensureUser(`${TAG}MDB`, 1, { agent_user_id: null });

  await conn.query(`UPDATE users SET referrer_id = ? WHERE id = ?`, [brokerId, merchantId]);
  await conn.query(`UPDATE users SET agent_user_id = ? WHERE id = ?`, [agentId, modelWithAgentId]);
  await conn.query(`UPDATE users SET agent_user_id = NULL WHERE id = ?`, [modelNoAgentId]);

  return { brokerId, agentId, merchantId, modelWithAgentId, modelNoAgentId };
}

async function insertPaidOrder(
  conn: mysql.Connection,
  merchantId: number,
  modelId: number,
  suffix: string
): Promise<number> {
  const orderNo = `${TAG}_${suffix}_${Date.now()}`;
  const payable = 1000;
  const platformFee = 150;
  const [r] = await conn.query<mysql.ResultSetHeader>(
    `INSERT INTO orders (
       order_no, merchant_user_id, model_user_id,
       booking_date, duration_kind, hour_count,
       unit_price_snapshot, service_amount, platform_fee, payable_amount,
       payment_status, payment_channel, paid_at, order_status
     ) VALUES (?,?,?,CURDATE(),'full_day',NULL,?,?,?,?,1,'smoke',NOW(),3)`,
    [orderNo, merchantId, modelId, payable, payable - platformFee, platformFee, payable]
  );
  return Number(r.insertId);
}

async function completeOrderViaService(orderId: number, merchantId: number): Promise<void> {
  const { confirmOrderCompleteByMerchant } = await import("../src/modules/order/order.service");
  await confirmOrderCompleteByMerchant(orderId, merchantId);
}

async function main(): Promise<void> {
  console.log(`API: ${BASE}`);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    charset: "utf8mb4"
  });

  try {
    const ids = await seedUsers(conn);
    console.log("种子用户:", ids);

    const orderA = await insertPaidOrder(conn, ids.merchantId, ids.modelWithAgentId, "A");
    const orderB = await insertPaidOrder(conn, ids.merchantId, ids.modelNoAgentId, "B");
    console.log(`订单 A(有代理人)=${orderA}  B(无代理人)=${orderB}`);

    await completeOrderViaService(orderA, ids.merchantId);
    await completeOrderViaService(orderB, ids.merchantId);
    console.log("商家确认完成 ✓");

    const token = await adminLogin();
    console.log("管理端登录 ✓");

    for (const [label, orderId] of [
      ["A·有代理人", orderA],
      ["B·无代理人", orderB]
    ] as const) {
      const { preview } = await adminFetch<{ preview: Preview }>(
        token,
        `/api/admin/orders/item/${orderId}/split-preview`
      );
      console.log(`\n--- 分账预览 ${label} (${preview.orderNo}) ---`);
      console.log(
        `  平台费 ${preview.amountsYuan.platformFee} | 模特 ${preview.amountsYuan.modelIncome} | 经纪人 ${preview.amountsYuan.brokerIncome} | 代理人 ${preview.amountsYuan.agentIncome}`
      );
      console.log(`  brokerUserId=${preview.brokerUserId} agentUserId=${preview.agentUserId}`);
    }

    const splitRes = await adminFetch<{ order: { orderId: number; splitCalculatedAt: string | null } }>(
      token,
      `/api/admin/orders/item/${orderA}/split`,
      { method: "POST" }
    );
    console.log(`\n订单 A 执行分账 ✓ splitCalculatedAt=${splitRes.order?.splitCalculatedAt ?? "—"}`);

    console.log("\n全部通过。可在后台打开订单详情核对。");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
