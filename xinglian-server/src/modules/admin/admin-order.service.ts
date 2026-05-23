import {
  countOrdersForAdmin,
  countOrdersForAdminByMerchantUserId,
  countOrdersForAdminByModelUserId,
  findOrderByIdForAdmin,
  findOrdersPageForAdmin,
  findOrdersPageForAdminByMerchantUserId,
  findOrdersPageForAdminByModelUserId
} from "./admin-order.repository";

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toDateKey(v: Date | string): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** orders.order_status：已完成 */
const ORDER_STATUS_COMPLETED = 4;

/** 列表分账状态文案：仅已完成订单区分待分账/已分账 */
export function splitStatusLabelForAdminList(
  orderStatus: number,
  splitCalculatedAtIso: string | null
): "-" | "待分账" | "已分账" {
  if (Number(orderStatus) !== ORDER_STATUS_COMPLETED) return "-";
  if (splitCalculatedAtIso == null || splitCalculatedAtIso === "") return "待分账";
  return "已分账";
}

function parseSplitConfigSnapshot(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "object") {
    if (Buffer.isBuffer(raw)) {
      try {
        return JSON.parse(raw.toString("utf8")) as unknown;
      } catch {
        return raw.toString("utf8");
      }
    }
    return raw;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

export type AdminOrderListItemDto = {
  parties: AdminOrderPartyItemDto[];
  orderId: number;
  orderNo: string;
  merchantUserId: number;
  merchantUserNo: string;
  merchantNickname: string;
  modelUserId: number;
  modelUserNo: string;
  modelNickname: string;
  brokerUserId: number | null;
  agentUserId: number | null;
  bookingDate: string;
  durationKind: string;
  hourCount: number | null;
  unitPriceSnapshot: number;
  serviceAmount: number;
  platformFee: number;
  payableAmount: number;
  modelIncome: number | null;
  brokerIncome: number | null;
  agentIncome: number | null;
  splitCalculatedAt: string | null;
  /** 分账状态展示：非已完成为 "-"，已完成为「待分账」或「已分账」 */
  splitStatusLabel: "-" | "待分账" | "已分账";
  paymentStatus: number;
  paymentChannel: string | null;
  paidAt: string | null;
  orderStatus: number;
  createdAt: string;
};

export type AdminOrderPartyDto = {
  userId: number | null;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName?: string | null;
};

/** 列表/详情参与方展示（不含 userId） */
export type AdminOrderPartyItemDto = {
  role: "merchant" | "model" | "broker" | "agent";
  roleLabel: string;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName?: string | null;
};

function partyItem(
  role: AdminOrderPartyItemDto["role"],
  roleLabel: string,
  userNo: string | null | undefined,
  nickname: string | null | undefined,
  realName: string | null | undefined,
  phone: string | null | undefined,
  companyName?: string | null | undefined
): AdminOrderPartyItemDto {
  return {
    role,
    roleLabel,
    userNo: strOrNull(userNo),
    nickname: strOrNull(nickname),
    realName: strOrNull(realName),
    phone: strOrNull(phone),
    ...(companyName !== undefined ? { companyName: strOrNull(companyName) } : {})
  };
}

function buildPartiesForAdminOrderRow(row: {
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  merchant_phone?: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
  model_phone?: string | null;
  broker_user_no?: string | null;
  broker_nickname?: string | null;
  broker_real_name?: string | null;
  broker_phone?: string | null;
  agent_user_no?: string | null;
  agent_nickname?: string | null;
  agent_real_name?: string | null;
  agent_company_name?: string | null;
  agent_phone?: string | null;
}): AdminOrderPartyItemDto[] {
  return [
    partyItem(
      "merchant",
      "商家",
      row.merchant_user_no,
      row.merchant_nickname,
      null,
      row.merchant_phone
    ),
    partyItem("model", "模特", row.model_user_no, row.model_nickname, null, row.model_phone),
    partyItem(
      "broker",
      "经纪人",
      row.broker_user_no,
      row.broker_nickname,
      row.broker_real_name,
      row.broker_phone
    ),
    partyItem(
      "agent",
      "代理人",
      row.agent_user_no,
      row.agent_nickname,
      row.agent_real_name,
      row.agent_phone,
      row.agent_company_name
    )
  ];
}

export type AdminOrderDetailDto = AdminOrderListItemDto & {
  remark: string | null;
  updatedAt: string;
  splitConfigSnapshot: unknown;
  merchantPhone: string | null;
  modelPhone: string | null;
  merchant: AdminOrderPartyDto;
  model: AdminOrderPartyDto;
  broker: AdminOrderPartyDto | null;
  agent: AdminOrderPartyDto | null;
};

function mapListRow(row: {
  id: number;
  order_no: string;
  merchant_user_id: number;
  model_user_id: number;
  broker_user_id?: number | null;
  agent_user_id?: number | null;
  booking_date: Date | string;
  duration_kind: string;
  hour_count: number | null;
  unit_price_snapshot: string | number;
  service_amount: string | number;
  platform_fee: string | number;
  payable_amount: string | number;
  model_income?: string | number | null;
  broker_income?: string | number | null;
  agent_income?: string | number | null;
  split_calculated_at?: Date | string | null;
  payment_status: number;
  payment_channel: string | null;
  paid_at: Date | string | null;
  order_status: number;
  created_at: Date | string;
  merchant_user_no: string | null;
  merchant_nickname: string | null;
  model_user_no: string | null;
  model_nickname: string | null;
}): AdminOrderListItemDto {
  return {
    parties: buildPartiesForAdminOrderRow(row),
    orderId: row.id,
    orderNo: row.order_no,
    merchantUserId: row.merchant_user_id,
    merchantUserNo: row.merchant_user_no || "",
    merchantNickname: row.merchant_nickname || "",
    modelUserId: row.model_user_id,
    modelUserNo: row.model_user_no || "",
    modelNickname: row.model_nickname || "",
    brokerUserId: numOrNull(row.broker_user_id),
    agentUserId: numOrNull(row.agent_user_id),
    bookingDate: toDateKey(row.booking_date),
    durationKind: row.duration_kind,
    hourCount: row.hour_count != null ? Number(row.hour_count) : null,
    unitPriceSnapshot: Number(row.unit_price_snapshot),
    serviceAmount: Number(row.service_amount),
    platformFee: Number(row.platform_fee),
    payableAmount: Number(row.payable_amount),
    modelIncome: numOrNull(row.model_income),
    brokerIncome: numOrNull(row.broker_income),
    agentIncome: numOrNull(row.agent_income),
    splitCalculatedAt: toIso(row.split_calculated_at),
    splitStatusLabel: splitStatusLabelForAdminList(Number(row.order_status), toIso(row.split_calculated_at)),
    paymentStatus: Number(row.payment_status),
    paymentChannel: row.payment_channel,
    paidAt: toIso(row.paid_at),
    orderStatus: Number(row.order_status),
    createdAt: toIso(row.created_at) ?? ""
  };
}

export async function listOrdersForAdmin(
  page: number,
  pageSize: number
): Promise<{
  list: AdminOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const total = await countOrdersForAdmin();
  const offset = (page - 1) * pageSize;
  const rows = await findOrdersPageForAdmin(offset, pageSize);

  return {
    list: rows.map((row) => mapListRow(row)),
    total,
    page,
    pageSize
  };
}

export async function listOrdersForAdminByMerchant(
  merchantUserId: number,
  page: number,
  pageSize: number
): Promise<{
  list: AdminOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const mid = Math.floor(Number(merchantUserId));
  if (!Number.isFinite(mid) || mid <= 0) {
    return { list: [], total: 0, page, pageSize };
  }
  const total = await countOrdersForAdminByMerchantUserId(mid);
  const offset = (page - 1) * pageSize;
  const rows = await findOrdersPageForAdminByMerchantUserId(mid, offset, pageSize);
  return {
    list: rows.map((row) => mapListRow(row)),
    total,
    page,
    pageSize
  };
}

export async function listOrdersForAdminByModel(
  modelUserId: number,
  page: number,
  pageSize: number
): Promise<{
  list: AdminOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const uid = Math.floor(Number(modelUserId));
  if (!Number.isFinite(uid) || uid <= 0) {
    return { list: [], total: 0, page, pageSize };
  }
  const total = await countOrdersForAdminByModelUserId(uid);
  const offset = (page - 1) * pageSize;
  const rows = await findOrdersPageForAdminByModelUserId(uid, offset, pageSize);
  return {
    list: rows.map((row) => mapListRow(row)),
    total,
    page,
    pageSize
  };
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function mapParty(
  userId: number | null | undefined,
  userNo: string | null | undefined,
  nickname: string | null | undefined,
  realName: string | null | undefined,
  phone: string | null | undefined,
  companyName?: string | null | undefined
): AdminOrderPartyDto {
  const id = numOrNull(userId);
  return {
    userId: id,
    userNo: strOrNull(userNo),
    nickname: strOrNull(nickname),
    realName: strOrNull(realName),
    phone: strOrNull(phone),
    ...(companyName !== undefined ? { companyName: strOrNull(companyName) } : {})
  };
}

export async function getOrderDetailForAdmin(orderId: number): Promise<AdminOrderDetailDto | null> {
  const row = await findOrderByIdForAdmin(orderId);
  if (!row) return null;
  const base = mapListRow(row);
  const brokerId = numOrNull(row.broker_user_id);
  const agentId = numOrNull(row.agent_user_id);
  return {
    ...base,
    parties: buildPartiesForAdminOrderRow(row),
    remark: row.remark,
    updatedAt: toIso(row.updated_at) ?? "",
    splitConfigSnapshot: parseSplitConfigSnapshot(row.split_config_snapshot),
    merchantPhone: strOrNull(row.merchant_phone),
    modelPhone: strOrNull(row.model_phone),
    merchant: mapParty(
      row.merchant_user_id,
      row.merchant_user_no,
      row.merchant_nickname,
      null,
      row.merchant_phone
    ),
    model: mapParty(row.model_user_id, row.model_user_no, row.model_nickname, null, row.model_phone),
    broker:
      brokerId != null
        ? mapParty(
            brokerId,
            row.broker_user_no,
            row.broker_nickname,
            row.broker_real_name,
            row.broker_phone
          )
        : null,
    agent:
      agentId != null
        ? mapParty(
            agentId,
            row.agent_user_no,
            row.agent_nickname,
            row.agent_real_name,
            row.agent_phone,
            row.agent_company_name
          )
        : null
  };
}
