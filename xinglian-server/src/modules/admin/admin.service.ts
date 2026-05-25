import {
  countOrdersCreatedInLastDays,
  countOrdersForAdmin,
  findOrderCountsGroupedByDayLastDays,
  findOrderCountsGroupedByOrderStatus,
  sumPayableAmountForAdmin
} from "./admin-order.repository";
import {
  applyModelProfileAuditDecision,
  countUsersForAdminByRole,
  findModelCategoriesForAdminByUserId,
  countUsersGroupedByRole123,
  findModelBasicDetailForAdminByUserId,
  findValidAgentUserIdForAdmin,
  findValidBrokerUserIdForAdmin,
  updateModelAgentUserIdForAdmin,
  updateMerchantReferrerIdForAdmin,
  findMerchantBasicDetailForAdminByUserId,
  findBrokerBasicDetailForAdminByUserId,
  countBoundMerchantsForBrokerAdmin,
  findBoundMerchantsPageForBrokerAdmin,
  findUsersPageForAdminByRole
} from "./admin.repository";
import { normalizePortfolioFromStorage } from "../model/model.portfolio";
import { enrichCardFromProfile } from "../model/model.service";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

const DASHBOARD_ORDER_STATUS_SEQUENCE = [1, 2, 3, 4, 9] as const;

function mergeDashboardOrderStatusCounts(
  rows: Array<{ order_status: number; cnt: number }>
): Array<{ orderStatus: number; count: number }> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.order_status, r.cnt);
  }
  const out: Array<{ orderStatus: number; count: number }> = [];
  for (const s of DASHBOARD_ORDER_STATUS_SEQUENCE) {
    out.push({ orderStatus: s, count: map.get(s) ?? 0 });
    map.delete(s);
  }
  const rest = [...map.entries()].sort((a, b) => a[0] - b[0]);
  for (const [orderStatus, count] of rest) {
    out.push({ orderStatus, count });
  }
  return out;
}

export async function getAdminDashboardStats(): Promise<{
  orderCount: number;
  orderPayableTotal: number;
  orderCountLast30Days: number;
  ordersDailyLast30Days: Array<{ date: string; count: number }>;
  ordersByStatus: Array<{ orderStatus: number; count: number }>;
  modelCount: number;
  merchantCount: number;
  brokerCount: number;
  agentCount: number;
}> {
  const [
    users,
    orderCount,
    orderPayableTotal,
    orderCountLast30Days,
    ordersDailyLast30Days,
    orderStatusRows
  ] = await Promise.all([
    countUsersGroupedByRole123(),
    countOrdersForAdmin(),
    sumPayableAmountForAdmin(),
    countOrdersCreatedInLastDays(30),
    findOrderCountsGroupedByDayLastDays(30),
    findOrderCountsGroupedByOrderStatus()
  ]);
  return {
    orderCount,
    orderPayableTotal,
    orderCountLast30Days,
    ordersDailyLast30Days,
    ordersByStatus: mergeDashboardOrderStatusCounts(orderStatusRows),
    ...users
  };
}

export async function listUsersForAdminByRole(
  page: number,
  pageSize: number,
  role: number
): Promise<{
  list: Array<{
    userId: number;
    userNo: string;
    nickname: string;
    avatarUrl: string | null;
    role: number;
    phone: string | null;
    status: number;
    verifiedStatus: number;
    profileAuditStatus: number;
    profileAuditRejectReason: string | null;
    /** 是否已绑定真实微信 openid */
    isWechatBound: boolean;
    orderEnabled: boolean | null;
    modelContractSignedAt: string | null;
    /** 平台与模特合同 broker_model */
    modelContractSignatureUrl: string | null;
    /** 平台与商家合同 platform_merchant，商家列表用 */
    merchantContractSignedAt: string | null;
    /** 平台与经纪人合同 platform_broker，经纪人列表用 */
    brokerContractSignedAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** 商家/经纪人：referrer_id 对应经纪人展示文案 */
    referrerBrokerLabel: string | null;
    /** 商家：绑定经纪人 users.id */
    referrerBrokerUserId: number | null;
    /** 模特：所属代理人展示文案 */
    agentUserLabel: string | null;
    /** 经纪人列表：referrer_id 指向该经纪人的商家数量 */
    boundMerchantCount: number;
    /** 经纪人列表：是否专业经纪人 */
    isProfessional?: boolean | null;
    /** 经纪人列表：经纪人证 URL */
    brokerLicenseUrl?: string | null;
    /** 模特列表：是否后管创建 */
    isAdminCreated?: boolean | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const total = await countUsersForAdminByRole(role);
  const offset = (page - 1) * pageSize;
  const rows = await findUsersPageForAdminByRole(role, offset, pageSize);

  return {
    list: rows.map((row) => ({
      userId: row.id,
      userNo: row.user_no,
      nickname: row.nickname || "",
      avatarUrl: row.avatar_url,
      role: Number(row.role),
      phone: row.phone,
      status: Number(row.status),
      verifiedStatus: Number(row.verified_status ?? 0),
      profileAuditStatus: Number(row.profile_audit_status ?? 0),
      profileAuditRejectReason: row.profile_audit_reject_reason
        ? String(row.profile_audit_reject_reason)
        : null,
      isWechatBound: Boolean(Number(row.is_wechat_bound ?? 0)),
      orderEnabled:
        row.model_order_enabled == null ? null : Boolean(Number(row.model_order_enabled)),
      modelContractSignedAt:
        row.contract_broker_model_signed_at instanceof Date
          ? row.contract_broker_model_signed_at.toISOString()
          : row.contract_broker_model_signed_at
            ? String(row.contract_broker_model_signed_at)
            : null,
      modelContractSignatureUrl: row.contract_broker_model_signature_url
        ? String(row.contract_broker_model_signature_url)
        : null,
      merchantContractSignedAt:
        row.contract_platform_merchant_signed_at instanceof Date
          ? row.contract_platform_merchant_signed_at.toISOString()
          : row.contract_platform_merchant_signed_at
            ? String(row.contract_platform_merchant_signed_at)
            : null,
      brokerContractSignedAt:
        row.contract_platform_broker_signed_at instanceof Date
          ? row.contract_platform_broker_signed_at.toISOString()
          : row.contract_platform_broker_signed_at
            ? String(row.contract_platform_broker_signed_at)
            : null,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
      referrerBrokerLabel: Number(row.role) === 1 ? null : formatReferrerBrokerLabelForAdmin(row),
      referrerBrokerUserId:
        Number(row.role) === 2 && row.referrer_broker_user_id != null
          ? Number(row.referrer_broker_user_id)
          : null,
      agentUserLabel: Number(row.role) === 1 ? formatAgentUserLabelForAdmin(row) : null,
      boundMerchantCount: Number(row.bound_merchant_count ?? 0),
      isProfessional:
        Number(row.role) === 3 && row.broker_is_professional != null
          ? Boolean(Number(row.broker_is_professional))
          : null,
      brokerLicenseUrl:
        Number(row.role) === 3 && row.broker_license_url
          ? String(row.broker_license_url)
          : null,
      isAdminCreated:
        Number(row.role) === 1 && row.model_is_admin_created != null
          ? Boolean(Number(row.model_is_admin_created))
          : null
    })),
    total,
    page,
    pageSize
  };
}

function formatAgentUserLabelForAdmin(row: {
  agent_user_no: string | null;
  agent_nickname: string | null;
  agent_real_name: string | null;
}): string | null {
  const no = row.agent_user_no != null ? String(row.agent_user_no).trim() : "";
  if (!no) return null;
  const rn = row.agent_real_name != null ? String(row.agent_real_name).trim() : "";
  const nn = row.agent_nickname != null ? String(row.agent_nickname).trim() : "";
  const name = rn || nn;
  return name ? `${name} · ${no}` : no;
}

function formatReferrerBrokerLabelForAdmin(row: {
  referrer_broker_user_no: string | null;
  referrer_broker_nickname: string | null;
  referrer_broker_real_name: string | null;
}): string | null {
  const no = row.referrer_broker_user_no != null ? String(row.referrer_broker_user_no).trim() : "";
  if (!no) return null;
  const rn =
    row.referrer_broker_real_name != null ? String(row.referrer_broker_real_name).trim() : "";
  const nn =
    row.referrer_broker_nickname != null ? String(row.referrer_broker_nickname).trim() : "";
  const name = rn || nn;
  return name ? `${no} · ${name}` : no;
}

function toDateYmd(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type AdminModelCardPayload = {
  photoAngles: Array<{ key: string; label?: string; url?: string; width?: number; height?: number }>;
  measurements: Record<string, unknown>;
  hairColor: string;
  skinColor: string;
};

type AdminStylePositionPayload = {
  photos: Array<{ id: string; url: string }>;
};

function parseCardJson(raw: unknown): AdminModelCardPayload {
  if (raw == null) return { photoAngles: [], measurements: {}, hairColor: "", skinColor: "" };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { photoAngles: [], measurements: {}, hairColor: "", skinColor: "" };
    try {
      parsed = JSON.parse(s);
    } catch {
      return { photoAngles: [], measurements: {}, hairColor: "", skinColor: "" };
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { photoAngles: [], measurements: {}, hairColor: "", skinColor: "" };
  }
  const obj = parsed as {
    photoAngles?: unknown;
    measurements?: unknown;
    hairColor?: unknown;
    skinColor?: unknown;
  };
  const photoAngles = Array.isArray(obj.photoAngles)
    ? obj.photoAngles.filter((x) => x && typeof x === "object").map((x) => x as {
        key: string;
        label?: string;
        url?: string;
        width?: number;
        height?: number;
      })
    : [];
  const measurements =
    obj.measurements && typeof obj.measurements === "object" && !Array.isArray(obj.measurements)
      ? (obj.measurements as Record<string, unknown>)
      : {};
  return {
    photoAngles,
    measurements,
    hairColor: obj.hairColor != null ? String(obj.hairColor).trim() : "",
    skinColor: obj.skinColor != null ? String(obj.skinColor).trim() : ""
  };
}

function parseStylePositionJson(raw: unknown): AdminStylePositionPayload {
  if (raw == null) return { photos: [] };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { photos: [] };
    try {
      parsed = JSON.parse(s);
    } catch {
      return { photos: [] };
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { photos: [] };
  }
  const obj = parsed as { photos?: unknown };
  const photos = Array.isArray(obj.photos)
    ? obj.photos
        .filter((x) => x && typeof x === "object")
        .map((x, index) => {
          const row = x as Record<string, unknown>;
          const url = String(row.url || "").trim();
          if (!url) return null;
          return {
            id: String(row.id || `style_${index}`),
            url
          };
        })
        .filter((x): x is { id: string; url: string } => Boolean(x))
    : [];
  return { photos };
}

function parseScheduleJson(raw: unknown): { scheduleMap: Record<string, "available" | "full" | "rest"> } {
  if (raw == null) return { scheduleMap: {} };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { scheduleMap: {} };
    try {
      parsed = JSON.parse(s);
    } catch {
      return { scheduleMap: {} };
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { scheduleMap: {} };
  }
  const obj = parsed as { scheduleMap?: unknown };
  const source = obj.scheduleMap;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { scheduleMap: {} };
  }
  const scheduleMap: Record<string, "available" | "full" | "rest"> = {};
  Object.entries(source as Record<string, unknown>).forEach(([k, v]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    if (v === "available" || v === "full" || v === "rest") {
      scheduleMap[k] = v;
    }
  });
  return { scheduleMap };
}

function parseOrderSettingsJson(
  raw: unknown,
  fallback: { orderEnabled: boolean; onlyLocal: boolean; onlyFemale: boolean }
): { orderEnabled: boolean; onlyLocal: boolean; onlyFemale: boolean } {
  if (raw == null) return fallback;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return fallback;
    try {
      parsed = JSON.parse(s);
    } catch {
      return fallback;
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }
  const obj = parsed as { settings?: unknown };
  const settings =
    obj.settings && typeof obj.settings === "object" && !Array.isArray(obj.settings)
      ? (obj.settings as Record<string, unknown>)
      : {};
  return {
    orderEnabled: Boolean(settings.orderEnabled ?? fallback.orderEnabled),
    onlyLocal: Boolean(settings.onlyLocal ?? fallback.onlyLocal),
    onlyFemale: Boolean(settings.onlyFemale ?? fallback.onlyFemale)
  };
}

export async function reviewModelProfileAuditForAdmin(
  targetUserId: number,
  decision: "approve" | "reject",
  rejectReason?: string
): Promise<{ profileAuditStatus: number }> {
  const trimmed = rejectReason?.trim() ?? "";
  if (decision === "reject" && !trimmed) {
    throw new AppError("请填写驳回原因", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const ok = await applyModelProfileAuditDecision(
    targetUserId,
    decision,
    decision === "approve" ? null : trimmed
  );
  if (!ok) {
    throw new AppError("当前状态不可审核（仅「审核中」的模特资料可操作）", 409, ErrorCodes.CONFLICT);
  }
  return { profileAuditStatus: decision === "approve" ? 2 : 3 };
}

export async function setModelAgentUserForAdmin(
  modelUserId: number,
  agentUserId: number | null
): Promise<{ agentUserId: number | null }> {
  const model = await findModelBasicDetailForAdminByUserId(modelUserId);
  if (!model) {
    throw new AppError("model user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (agentUserId != null) {
    const valid = await findValidAgentUserIdForAdmin(agentUserId);
    if (valid == null) {
      throw new AppError("代理人不存在或已禁用", 400, ErrorCodes.VALIDATION_ERROR);
    }
  }
  const ok = await updateModelAgentUserIdForAdmin(modelUserId, agentUserId);
  if (!ok) {
    throw new AppError("model user not found", 404, ErrorCodes.NOT_FOUND);
  }
  return { agentUserId };
}

export async function setMerchantBrokerForAdmin(
  merchantUserId: number,
  brokerUserId: number | null
): Promise<{ brokerUserId: number | null }> {
  const merchant = await findMerchantBasicDetailForAdminByUserId(merchantUserId);
  if (!merchant) {
    throw new AppError("merchant user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (brokerUserId != null) {
    const valid = await findValidBrokerUserIdForAdmin(brokerUserId);
    if (valid == null) {
      throw new AppError("经纪人不存在、已禁用或未签署平台合同", 400, ErrorCodes.VALIDATION_ERROR);
    }
  }
  const ok = await updateMerchantReferrerIdForAdmin(merchantUserId, brokerUserId);
  if (!ok) {
    throw new AppError("merchant user not found", 404, ErrorCodes.NOT_FOUND);
  }
  return { brokerUserId };
}

export async function getModelBasicDetailForAdmin(userId: number): Promise<{
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  status: number;
  agentUserId: number | null;
  agentUser: {
    userId: number;
    userNo: string;
    nickname: string | null;
    realName: string | null;
  } | null;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  contractSignedAt: string | null;
  contractSignatureUrl: string | null;
  phone: string | null;
  realName: string | null;
  idCardNo: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardIssueAuthority: string | null;
  idCardValidDate: string | null;
  name: string;
  gender: "女" | "男";
  birthDate: string | null;
  city: string | null;
  intro: string | null;
  price: {
    hourly: number | null;
    halfDay: number | null;
    fullDay: number | null;
  };
  categories: Array<{
    id: number;
    name: string;
    type: "main" | "style" | "scene";
  }>;
  card: {
    photoAngles: Array<{ key: string; label?: string; url?: string; width?: number; height?: number }>;
    measurements: Record<string, unknown>;
    hairColor: string;
    skinColor: string;
  };
  schedule: {
    scheduleMap: Record<string, "available" | "full" | "rest">;
  };
  orderSettings: {
    orderEnabled: boolean;
    onlyLocal: boolean;
    onlyFemale: boolean;
  };
  portfolio: {
    folders: Array<{ id: string; name: string; coverPhotoId?: string }>;
    photos: Array<{ id: string; folderId: string; url: string }>;
  };
  stylePosition: {
    photos: Array<{ id: string; url: string }>;
  };
  isAdminCreated: boolean;
}> {
  const row = await findModelBasicDetailForAdminByUserId(userId);
  if (!row) {
    throw new AppError("model user not found", 404, ErrorCodes.NOT_FOUND);
  }
  const categories = await findModelCategoriesForAdminByUserId(userId);
  const card = enrichCardFromProfile(parseCardJson(row.card_json), {
    height: row.height,
    weight: row.weight,
    bust: row.bust,
    waist: row.waist,
    hip: row.hip,
    shoe_size: row.shoe_size,
    hair_color: row.hair_color,
    skin_tone: row.skin_tone
  }) as AdminModelCardPayload;
  const portfolio = normalizePortfolioFromStorage(row.portfolio_json, { stripNonRemoteUrls: false });
  const stylePosition = parseStylePositionJson(row.style_position_json);
  const schedule = parseScheduleJson(row.schedule_json);
  const orderSettings = parseOrderSettingsJson(row.order_settings_json, {
    orderEnabled: Boolean(row.is_available),
    onlyLocal: Boolean(row.only_local_orders),
    onlyFemale: Boolean(row.only_female_clients)
  });

  const agentId =
    row.agent_user_id != null && Number.isFinite(Number(row.agent_user_id))
      ? Number(row.agent_user_id)
      : null;
  const agentNo = row.agent_user_no ? String(row.agent_user_no).trim() : "";
  const agentUser =
    agentId != null && agentNo
      ? {
          userId: agentId,
          userNo: agentNo,
          nickname: row.agent_nickname ? String(row.agent_nickname) : null,
          realName: row.agent_real_name ? String(row.agent_real_name) : null
        }
      : agentId != null
        ? {
            userId: agentId,
            userNo: String(agentId),
            nickname: row.agent_nickname ? String(row.agent_nickname) : null,
            realName: row.agent_real_name ? String(row.agent_real_name) : null
          }
        : null;

  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url,
    status: Number(row.status ?? 0),
    agentUserId: agentId,
    agentUser,
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    profileAuditRejectReason: row.profile_audit_reject_reason
      ? String(row.profile_audit_reject_reason)
      : null,
    contractSignedAt:
      row.contract_broker_model_signed_at instanceof Date
        ? row.contract_broker_model_signed_at.toISOString()
        : row.contract_broker_model_signed_at
          ? String(row.contract_broker_model_signed_at)
          : null,
    contractSignatureUrl: row.contract_broker_model_signature_url
      ? String(row.contract_broker_model_signature_url)
      : null,
    phone: row.phone,
    realName: row.real_name,
    idCardNo: row.id_card_no,
    idCardFrontUrl: row.id_card_front_url,
    idCardBackUrl: row.id_card_back_url,
    idCardIssueAuthority: row.id_card_issue_authority,
    idCardValidDate: row.id_card_valid_date,
    name: row.stage_name || "",
    gender: Number(row.gender) === 1 ? "男" : "女",
    birthDate: toDateYmd(row.birth_date),
    city: row.city,
    intro: row.intro,
    price: {
      hourly: row.price_hour != null ? Number(row.price_hour) : null,
      halfDay: row.price_halfday != null ? Number(row.price_halfday) : null,
      fullDay: row.price_allday != null ? Number(row.price_allday) : null
    },
    categories: categories.map((item) => ({
      id: Number(item.id),
      name: item.name,
      type: item.type
    })),
    card,
    portfolio,
    stylePosition,
    schedule,
    orderSettings,
    isAdminCreated: Boolean(Number(row.is_admin_created ?? 0))
  };
}

export async function getMerchantBasicDetailForAdmin(userId: number): Promise<{
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  city: string | null;
  contractPlatformMerchantSignedAt: string | null;
  contractPlatformMerchantSignatureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  referrerBroker: {
    userId: number | null;
    userNo: string | null;
    nickname: string | null;
    realName: string | null;
  } | null;
}> {
  const row = await findMerchantBasicDetailForAdminByUserId(userId);
  if (!row) {
    throw new AppError("merchant user not found", 404, ErrorCodes.NOT_FOUND);
  }
  const refId =
    row.referrer_broker_user_id != null && Number.isFinite(Number(row.referrer_broker_user_id))
      ? Number(row.referrer_broker_user_id)
      : null;
  const refNo = row.referrer_broker_user_no ? String(row.referrer_broker_user_no) : null;
  const referrerBroker =
    refId != null || refNo || row.referrer_broker_nickname || row.referrer_broker_real_name
      ? {
          userId: refId,
          userNo: refNo,
          nickname: row.referrer_broker_nickname ? String(row.referrer_broker_nickname) : null,
          realName: row.referrer_broker_real_name ? String(row.referrer_broker_real_name) : null
        }
      : null;

  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url,
    phone: row.phone,
    status: Number(row.status ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    profileAuditRejectReason: row.profile_audit_reject_reason
      ? String(row.profile_audit_reject_reason)
      : null,
    city: row.city,
    contractPlatformMerchantSignedAt:
      row.contract_platform_merchant_signed_at instanceof Date
        ? row.contract_platform_merchant_signed_at.toISOString()
        : row.contract_platform_merchant_signed_at
          ? String(row.contract_platform_merchant_signed_at)
          : null,
    contractPlatformMerchantSignatureUrl: row.contract_platform_merchant_signature_url
      ? String(row.contract_platform_merchant_signature_url)
      : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
    referrerBroker
  };
}

export async function getBrokerBasicDetailForAdmin(userId: number): Promise<{
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  realName: string | null;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  contractPlatformBrokerSignedAt: string | null;
  contractPlatformBrokerSignatureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  boundMerchantCount: number;
  referrerBroker: {
    userNo: string | null;
    nickname: string | null;
    realName: string | null;
  } | null;
  isProfessional: boolean;
  brokerLicenseUrl: string | null;
}> {
  const row = await findBrokerBasicDetailForAdminByUserId(userId);
  if (!row) {
    throw new AppError("broker user not found", 404, ErrorCodes.NOT_FOUND);
  }
  const refNo = row.referrer_broker_user_no ? String(row.referrer_broker_user_no) : null;
  const referrerBroker =
    refNo || row.referrer_broker_nickname || row.referrer_broker_real_name
      ? {
          userNo: refNo,
          nickname: row.referrer_broker_nickname ? String(row.referrer_broker_nickname) : null,
          realName: row.referrer_broker_real_name ? String(row.referrer_broker_real_name) : null
        }
      : null;

  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url,
    realName: row.broker_real_name ? String(row.broker_real_name) : null,
    phone: row.phone,
    status: Number(row.status ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    profileAuditRejectReason: row.profile_audit_reject_reason
      ? String(row.profile_audit_reject_reason)
      : null,
    contractPlatformBrokerSignedAt:
      row.contract_platform_broker_signed_at instanceof Date
        ? row.contract_platform_broker_signed_at.toISOString()
        : row.contract_platform_broker_signed_at
          ? String(row.contract_platform_broker_signed_at)
          : null,
    contractPlatformBrokerSignatureUrl: row.contract_platform_broker_signature_url
      ? String(row.contract_platform_broker_signature_url)
      : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
    boundMerchantCount: Number(row.bound_merchant_count ?? 0),
    referrerBroker,
    isProfessional: Boolean(Number(row.broker_is_professional ?? 0)),
    brokerLicenseUrl: row.broker_license_url ? String(row.broker_license_url) : null
  };
}

function mapBoundMerchantRowForBrokerAdmin(row: {
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
}) {
  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url,
    phone: row.phone,
    status: Number(row.status ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    city: row.city,
    merchantContractSignedAt:
      row.contract_platform_merchant_signed_at instanceof Date
        ? row.contract_platform_merchant_signed_at.toISOString()
        : row.contract_platform_merchant_signed_at
          ? String(row.contract_platform_merchant_signed_at)
          : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? "")
  };
}

export async function listBoundMerchantsForBrokerAdmin(
  brokerUserId: number,
  page: number,
  pageSize: number
): Promise<{
  list: ReturnType<typeof mapBoundMerchantRowForBrokerAdmin>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const bid = Math.floor(Number(brokerUserId));
  if (!Number.isFinite(bid) || bid <= 0) {
    return { list: [], total: 0, page, pageSize };
  }
  const total = await countBoundMerchantsForBrokerAdmin(bid);
  const offset = (page - 1) * pageSize;
  const rows = await findBoundMerchantsPageForBrokerAdmin(bid, offset, pageSize);
  return {
    list: rows.map((r) => mapBoundMerchantRowForBrokerAdmin(r)),
    total,
    page,
    pageSize
  };
}
