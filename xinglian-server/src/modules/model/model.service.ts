import {
  ensureModelExtra,
  ensureModelProfile,
  ensureLeafCategoryIds,
  findCategoryTreeRows,
  findMerchantModelList,
  findMyCategoryIds,
  findModelExtra,
  findModelProfile,
  findPublicModelDetailByUserId,
  findPublicModelDetailByUserNo,
  replaceMyCategoryIds,
  trySetModelProfileAuditPending,
  updateBasicInfo,
  updateExtraJson,
  updateOrderSettings,
  updatePricing,
  syncModelProfileFromCard,
  updateUserPhone
} from "./model.repository";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import {
  normalizePortfolioForPersist,
  normalizePortfolioFromStorage
} from "./model.portfolio";
import { basicInfoSchema, cardSchema } from "./model.types";
import { findUserProfileById } from "../user/user.repository";

type CategoryTreeNode = {
  id: number;
  name: string;
  children: CategoryTreeNode[];
};

function uniqIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDefaultRestScheduleMap(): Record<string, "available" | "full" | "rest"> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map: Record<string, "available" | "full" | "rest"> = {};
  for (let i = 1; i <= 30; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    map[formatDateKey(d)] = "rest";
  }
  return map;
}

function normalizeScheduleMap(raw: unknown): Record<string, "available" | "full" | "rest"> {
  const base = buildDefaultRestScheduleMap();
  const rawMap =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  Object.entries(rawMap).forEach(([dateKey, status]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    if (Object.prototype.hasOwnProperty.call(base, dateKey)) {
      if (status === "available" || status === "full" || status === "rest") {
        base[dateKey] = status;
      }
    }
  });
  return base;
}

function toYmdDateString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return formatDateKey(d);
    return "";
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return formatDateKey(value);
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return formatDateKey(d);
}

function toPositiveIntOrEmpty(value: unknown): number | "" {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return Math.trunc(n);
}

function validateSchedulePayload(scheduleMap: Record<string, unknown>): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstAllowed = new Date(today);
  firstAllowed.setDate(firstAllowed.getDate() + 1);
  const lastAllowed = new Date(today);
  lastAllowed.setDate(lastAllowed.getDate() + 30);
  const minKey = formatDateKey(firstAllowed);
  const maxKey = formatDateKey(lastAllowed);

  for (const [dateKey, status] of Object.entries(scheduleMap)) {
    if (dateKey < minKey || dateKey > maxKey) {
      throw new AppError("档期仅支持修改未来30天", 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (status !== "available" && status !== "full" && status !== "rest") {
      throw new AppError("档期状态不合法", 400, ErrorCodes.VALIDATION_ERROR);
    }
  }
}

export async function getCategoryTree(): Promise<{
  mainTypeGroups: CategoryTreeNode[];
  styleGroups: CategoryTreeNode[];
  sceneGroups: CategoryTreeNode[];
}> {
  const rows = await findCategoryTreeRows();
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<number | null, number[]>();
  for (const row of rows) {
    const list = childrenByParent.get(row.parent_id) || [];
    list.push(row.id);
    childrenByParent.set(row.parent_id, list);
  }

  const buildNode = (id: number): CategoryTreeNode => {
    const row = rowById.get(id);
    if (!row) return { id, name: "", children: [] };
    const childIds = childrenByParent.get(id) || [];
    return {
      id: row.id,
      name: row.name,
      children: childIds.map((childId) => buildNode(childId))
    };
  };

  const roots = (childrenByParent.get(null) || [])
    .map((id) => {
      const row = rowById.get(id);
      if (!row) return null;
      return { type: row.type, node: buildNode(id) };
    })
    .filter((item): item is { type: "main" | "style" | "scene"; node: CategoryTreeNode } => Boolean(item));

  return {
    mainTypeGroups: roots.filter((item) => item.type === "main").map((item) => item.node),
    styleGroups: roots.filter((item) => item.type === "style").map((item) => item.node),
    sceneGroups: roots.filter((item) => item.type === "scene").map((item) => item.node)
  };
}

export async function getMyCategories(userId: number): Promise<{ categoryIds: number[] }> {
  const categoryIds = await findMyCategoryIds(userId);
  return { categoryIds };
}

export async function getMerchantModelList(): Promise<{
  list: Array<{
    userId: number;
    userNo: string;
    nickname: string;
    avatarUrl: string;
    city: string;
      intro: string;
    price: {
      hourly: number | null;
      halfDay: number | null;
      fullDay: number | null;
    };
    categories: string[];
    profileAuditStatus: number;
    /** 模卡：与详情页 /api/models/detail 中 card 结构一致 */
    card: {
      photoAngles: Array<{ key?: string; label?: string; url?: string }>;
      measurements: Record<string, unknown>;
    };
  }>;
}> {
  const rows = await findMerchantModelList(50);
  return {
    list: rows.map((row) => {
      const parsed =
        parseJsonField(row.card_json) || ({ photoAngles: [], measurements: {} } as Record<string, unknown>);
      const rawAngles = parsed.photoAngles;
      const photoAngles = Array.isArray(rawAngles)
        ? rawAngles
            .filter((x) => x && typeof x === "object")
            .map((x) => x as Record<string, unknown>)
            .map((x) => ({
              key: x.key != null ? String(x.key) : undefined,
              label: x.label != null ? String(x.label) : undefined,
              url: x.url != null ? String(x.url) : undefined
            }))
        : [];
      const rawMeas = parsed.measurements;
      const measurements =
        rawMeas && typeof rawMeas === "object" && !Array.isArray(rawMeas)
          ? (rawMeas as Record<string, unknown>)
          : {};
      return {
        userId: row.id,
        userNo: row.user_no,
        nickname: row.nickname || `模特${row.user_no}`,
        avatarUrl: row.avatar_url != null ? String(row.avatar_url) : "",
        city: row.city || "",
        intro: row.intro || "",
        price: {
          hourly: row.price_hour,
          halfDay: row.price_halfday,
          fullDay: row.price_allday
        },
        categories: String(row.category_names || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        profileAuditStatus: Number(row.profile_audit_status || 0),
        card: { photoAngles, measurements }
      };
    })
  };
}

/** mysql2 对 JSON 列常直接返回 object；历史数据也可能是 string */
function parseJsonColumn(value: unknown): unknown {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString("utf8"));
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsonField(value: unknown): Record<string, unknown> | null {
  const parsed = parseJsonColumn(value);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function normalizeStylePositionFromStorage(value: unknown): { photos: Array<{ id: string; url: string }> } {
  const parsed = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawPhotos = Array.isArray(parsed.photos) ? parsed.photos : [];
  return {
    photos: rawPhotos
      .filter((item) => item && typeof item === "object")
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const url = String(row.url || "").trim();
        if (!url) return null;
        return {
          id: String(row.id || `style_${index}`),
          url
        };
      })
      .filter((item): item is { id: string; url: string } => Boolean(item))
      .slice(0, 100)
  };
}

function normalizeStylePositionForPersist(payload: Record<string, unknown>): { photos: Array<{ id: string; url: string }> } {
  const rawPhotos = Array.isArray(payload.photos) ? payload.photos : [];
  return {
    photos: rawPhotos
      .filter((item) => item && typeof item === "object")
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const url = String(row.url || "").trim();
        if (!url) return null;
        return {
          id: String(row.id || `style_${Date.now()}_${index}`).slice(0, 80),
          url
        };
      })
      .filter((item): item is { id: string; url: string } => Boolean(item))
      .slice(0, 100)
  };
}

type ProfileBodyFallback = {
  height?: number | null;
  weight?: number | null;
  bust?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoe_size?: string | null;
  hair_color?: string | null;
  skin_tone?: string | null;
};

/** 历史数据在 model_profiles 时，读模卡接口仍带出（直至用户保存模卡写入 card_json） */
export function enrichCardFromProfile(
  card: Record<string, unknown>,
  profile: ProfileBodyFallback | null | undefined
): Record<string, unknown> {
  const rawMeas = card.measurements;
  const measurements: Record<string, unknown> =
    rawMeas && typeof rawMeas === "object" && !Array.isArray(rawMeas)
      ? { ...(rawMeas as Record<string, unknown>) }
      : {};
  if (profile) {
    const numFields = ["height", "weight", "bust", "waist", "hip"] as const;
    for (const key of numFields) {
      const v = profile[key];
      if ((measurements[key] == null || measurements[key] === "") && v != null) {
        measurements[key] = v;
      }
    }
    if (measurements.shoeSize == null || measurements.shoeSize === "") {
      const shoe = profile.shoe_size;
      if (shoe != null && String(shoe).trim() !== "") {
        const n = Number(shoe);
        if (Number.isFinite(n) && n > 0) {
          measurements.shoeSize = Math.trunc(n);
        }
      }
    }
  }
  const hairColor =
    String(card.hairColor ?? "").trim() ||
    (profile?.hair_color != null ? String(profile.hair_color).trim() : "");
  const skinColor =
    String(card.skinColor ?? "").trim() ||
    (profile?.skin_tone != null ? String(profile.skin_tone).trim() : "");
  return {
    ...card,
    measurements,
    hairColor,
    skinColor
  };
}

export async function getModelPublicDetail(
  query: {
    userNo?: string;
    userId?: number;
  },
  options?: { viewerRole?: number }
): Promise<Record<string, unknown>> {
  const row = query.userNo
    ? await findPublicModelDetailByUserNo(query.userNo)
    : await findPublicModelDetailByUserId(query.userId as number);
  if (!row) {
    throw new AppError("model not found", 404, ErrorCodes.NOT_FOUND);
  }

  /** 公开浏览仅展示资料审核已通过（2）的模特，与 /api/models/list 口径一致 */
  if (Number(options?.viewerRole ?? 0) !== 1 && Number(row.profile_audit_status ?? 0) !== 2) {
    throw new AppError("model not found", 404, ErrorCodes.NOT_FOUND);
  }

  const card = parseJsonField(row.card_json) || { photoAngles: [], measurements: {} };
  const portfolio = normalizePortfolioFromStorage(parseJsonField(row.portfolio_json), {
    stripNonRemoteUrls: true
  });
  const stylePosition = normalizeStylePositionFromStorage(parseJsonField(row.style_position_json));
  const scheduleRaw = parseJsonField(row.schedule_json) || { scheduleMap: {} };
  const scheduleMap = normalizeScheduleMap(scheduleRaw.scheduleMap);
  const orderSettingsRaw = parseJsonField(row.order_settings_json);
  const orderSettings =
    orderSettingsRaw && typeof orderSettingsRaw.settings === "object" && orderSettingsRaw.settings
      ? (orderSettingsRaw.settings as Record<string, unknown>)
      : {
          orderEnabled: Boolean(row.is_available),
          onlyLocal: Boolean(row.only_local_orders),
          onlyFemale: Boolean(row.only_female_clients)
        };

  const gender = row.profile_gender === 1 ? "男" : "女";

  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || `模特${row.user_no}`,
    avatarUrl: row.avatar_url || "",
    city: row.city || "",
    intro: row.intro || "",
    gender,
    price: {
      hourly: row.price_hour,
      halfDay: row.price_halfday,
      fullDay: row.price_allday
    },
    profileAuditStatus: Number(row.profile_audit_status || 0),
    card: enrichCardFromProfile(card, {
      height: row.height,
      weight: row.weight,
      bust: row.bust,
      waist: row.waist,
      hip: row.hip,
      shoe_size: row.shoe_size,
      hair_color: row.hair_color,
      skin_tone: row.skin_tone
    }),
    portfolio,
    stylePosition,
    schedule: {
      scheduleMap
    },
    orderSettings: {
      orderEnabled: Boolean(orderSettings.orderEnabled ?? row.is_available),
      onlyLocal: Boolean(orderSettings.onlyLocal ?? row.only_local_orders),
      onlyFemale: Boolean(orderSettings.onlyFemale ?? row.only_female_clients)
    }
  };
}

export async function getModelData(userId: number): Promise<Record<string, unknown>> {
  await ensureModelProfile(userId);
  await ensureModelExtra(userId);

  const profile = await findModelProfile(userId);
  const extra = await findModelExtra(userId);

  const categoryIds = await findMyCategoryIds(userId);
  const cardRaw =
    (parseJsonColumn(extra?.card_json) as Record<string, unknown> | null) || { photoAngles: [], measurements: {} };
  const card = enrichCardFromProfile(cardRaw, profile);
  const portfolio = normalizePortfolioFromStorage(parseJsonColumn(extra?.portfolio_json), {
    stripNonRemoteUrls: false
  });
  const stylePosition = normalizeStylePositionFromStorage(parseJsonColumn(extra?.style_position_json));
  const scheduleRaw =
    (parseJsonColumn(extra?.schedule_json) as Record<string, unknown> | null) || { scheduleMap: {} };
  const schedule = {
    scheduleMap: normalizeScheduleMap(scheduleRaw.scheduleMap)
  };
  const orderSettings =
    (parseJsonColumn(extra?.order_settings_json) as Record<string, unknown> | null) ||
    {
      settings: {
        orderEnabled: Number(profile?.is_available ?? 0) === 1,
        onlyLocal: Boolean(profile?.only_local_orders ?? 0),
        onlyFemale: Boolean(profile?.only_female_clients ?? 0)
      }
    };

  return {
    basicInfo: {
      name: profile?.stage_name ?? "",
      gender: profile?.gender === 1 ? "男" : "女",
      birthDate: toYmdDateString(profile?.birth_date),
      city: profile?.city ?? "",
      intro: profile?.intro ?? "",
      phone: profile?.phone ?? ""
    },
    pricing: {
      hourly: toPositiveIntOrEmpty(profile?.price_hour),
      halfDay: toPositiveIntOrEmpty(profile?.price_halfday),
      fullDay: toPositiveIntOrEmpty(profile?.price_allday)
    },
    categories: { categoryIds },
    card,
    portfolio,
    stylePosition,
    schedule,
    orderSettings
  };
}

export async function saveBasicInfo(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelProfile(userId);
  await updateBasicInfo(userId, payload);
  await updateUserPhone(userId, (payload.phone as string) || null);
}

export async function saveCategories(userId: number, payload: Record<string, unknown>): Promise<void> {
  const ids = uniqIds(((payload.categoryIds as number[]) || []).map((id) => Number(id)));
  await ensureLeafCategoryIds(ids);
  await replaceMyCategoryIds(userId, ids);
}

export async function saveCard(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelProfile(userId);
  await ensureModelExtra(userId);
  await updateExtraJson(userId, "card_json", payload);
  await syncModelProfileFromCard(userId, payload);
}

export async function savePortfolio(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelExtra(userId);
  const canonical = normalizePortfolioForPersist(payload);
  await updateExtraJson(userId, "portfolio_json", canonical);
}

export async function saveStylePosition(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelExtra(userId);
  const canonical = normalizeStylePositionForPersist(payload);
  await updateExtraJson(userId, "style_position_json", canonical);
}

export async function savePricing(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelProfile(userId);
  await updatePricing(userId, payload);
}

export async function saveSchedule(userId: number, payload: Record<string, unknown>): Promise<void> {
  await ensureModelExtra(userId);
  const incomingMap = (payload.scheduleMap as Record<string, unknown>) || {};
  validateSchedulePayload(incomingMap);
  await updateExtraJson(userId, "schedule_json", {
    scheduleMap: normalizeScheduleMap(incomingMap)
  });
}

export async function saveOrderSettings(userId: number, payload: { settings: Record<string, unknown> }): Promise<void> {
  await ensureModelProfile(userId);
  await ensureModelExtra(userId);
  await updateOrderSettings(userId, payload.settings);
}

export type ProfileAuditReadinessItem = {
  key: string;
  label: string;
  done: boolean;
};

function isModelBasicInfoCompleteForAudit(profile: NonNullable<Awaited<ReturnType<typeof findModelProfile>>>): boolean {
  const genderLabel = profile.gender === 1 ? "男" : profile.gender === 2 ? "女" : "";
  const payload = {
    name: profile.stage_name ?? "",
    gender: genderLabel,
    birthDate: toYmdDateString(profile.birth_date),
    city: profile.city ?? "",
    intro: profile.intro ?? "",
    phone: profile.phone ?? ""
  };
  return basicInfoSchema.safeParse(payload).success;
}

function isModelPricingCompleteForAudit(profile: NonNullable<Awaited<ReturnType<typeof findModelProfile>>>): boolean {
  const ok = (v: unknown): boolean => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  };
  return ok(profile.price_hour) && ok(profile.price_halfday) && ok(profile.price_allday);
}

function isBrokerModelContractSigned(
  user: NonNullable<Awaited<ReturnType<typeof findUserProfileById>>>
): boolean {
  return user.contract_broker_model_signed_at != null && String(user.contract_broker_model_signed_at).trim() !== "";
}

export async function getProfileAuditReadiness(userId: number): Promise<{
  items: ProfileAuditReadinessItem[];
  allDone: boolean;
  completedCount: number;
  totalCount: number;
  percent: number;
}> {
  const userRow = await findUserProfileById(userId);
  if (!userRow || userRow.role !== 1) {
    throw new AppError("仅模特可查看资料审核完成度", 403, ErrorCodes.FORBIDDEN);
  }

  await ensureModelProfile(userId);
  await ensureModelExtra(userId);

  const profile = await findModelProfile(userId);
  const extra = await findModelExtra(userId);
  const categoryIds = await findMyCategoryIds(userId);

  const basicDone = profile ? isModelBasicInfoCompleteForAudit(profile) : false;
  const categoriesDone = categoryIds.length >= 1;

  const rawCard = parseJsonColumn(extra?.card_json);
  const cardPayload =
    rawCard && typeof rawCard === "object" && !Array.isArray(rawCard)
      ? (rawCard as Record<string, unknown>)
      : { photoAngles: [], measurements: {} };
  const cardDone = cardSchema.safeParse(cardPayload).success;
  const pricingDone = profile ? isModelPricingCompleteForAudit(profile) : false;
  const contractDone = isBrokerModelContractSigned(userRow);

  const items: ProfileAuditReadinessItem[] = [
    { key: "basicInfo", label: "基本信息", done: basicDone },
    { key: "categories", label: "模特分类", done: categoriesDone },
    { key: "card", label: "模卡", done: cardDone },
    { key: "pricing", label: "服务价格设置", done: pricingDone },
    { key: "contract", label: "合同签署", done: contractDone }
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount;
  const percent = totalCount === 0 ? 0 : Math.round((100 * completedCount) / totalCount);

  return { items, allDone, completedCount, totalCount, percent };
}

export async function submitProfileAudit(userId: number): Promise<void> {
  const userRow = await findUserProfileById(userId);
  if (!userRow || userRow.role !== 1) {
    throw new AppError("仅模特可提交资料审核", 403, ErrorCodes.FORBIDDEN);
  }

  const st = Number(userRow.profile_audit_status ?? 0);
  if (st === 1) {
    throw new AppError("资料已在审核中", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (st === 2) {
    throw new AppError("资料已通过审核", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const readiness = await getProfileAuditReadiness(userId);
  if (!readiness.allDone) {
    throw new AppError("请先完成基本信息、模特分类、模卡、服务价格及合同签署后再提交", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const updated = await trySetModelProfileAuditPending(userId);
  if (!updated) {
    throw new AppError("提交失败，请稍后重试", 409, ErrorCodes.CONFLICT);
  }
}
