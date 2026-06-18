import {
  countPublicHomeUsers,
  ensureModelExtra,
  ensureModelProfile,
  ensureLeafCategoryIds,
  findCategoryTreeRows,
  findMerchantModelList,
  MerchantModelListFilters,
  findMyCategoryIds,
  findModelExtra,
  findModelProfile,
  findPublicModelDetailByUserId,
  findPublicModelDetailByUserNo,
  replaceMyCategoryIds,
  trySetModelProfileAuditPending,
  updateBasicInfo,
  updateExtraJson,
  updateModelExtraSectionWithReview,
  approveAllModelContentReviewForAdmin,
  updateOrderSettings,
  updatePricing,
  syncModelProfileFromCard,
  updateUserPhone
} from "./model.repository";
import {
  buildContentReviewState,
  deriveSectionReviewFromPhotos,
  extractSectionPhotos,
  materializeLegacyPhotoReviewsInPayload,
  mergeSectionPhotoReviewsOnSave,
  stripSectionPhotosForPublic
} from "./model-content-review";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { getHomeStatOffsets } from "../system-settings/system-settings.service";
import {
  normalizePortfolioForPersist,
  normalizePortfolioFromStorage
} from "./model.portfolio";
import { buildModelLevel, ModelLevelInfo } from "./model-level";
import { basicInfoSchema } from "./model.types";
import { findUserProfileById } from "../user/user.repository";
import { isModelRealnameVerified } from "../user/user.service";
import { listHonorsForPublicDisplay } from "./model-honor.service";

type CategoryTreeNode = {
  id: number;
  name: string;
  children: CategoryTreeNode[];
};

function uniqIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
}

const EMPTY_PUBLIC_CARD = {
  photoAngles: [] as Array<{ key?: string; label?: string; url?: string }>,
  measurements: {} as Record<string, unknown>
};
const EMPTY_PUBLIC_PORTFOLIO = { folders: [], photos: [] };
const EMPTY_PUBLIC_STYLE_POSITION = { photos: [] as Array<{ id: string; url: string }> };

function isPhotosDisabledFlag(value: unknown): boolean {
  return Boolean(Number(value ?? 0));
}

/** 用户端公开接口：仅展示审核通过的单张图片；身材数据等非图片内容始终可见 */
function stripModelPhotosForPublic<T extends Record<string, unknown>>(
  payload: T,
  photosDisabled: boolean
): T {
  if (photosDisabled) {
    return {
      ...payload,
      card: { ...(payload.card as Record<string, unknown>), photoAngles: [] },
      portfolio: EMPTY_PUBLIC_PORTFOLIO,
      stylePosition: EMPTY_PUBLIC_STYLE_POSITION
    };
  }
  const cardRaw = (payload.card as Record<string, unknown>) || {};
  return {
    ...payload,
    card: stripSectionPhotosForPublic("card", cardRaw),
    portfolio: stripSectionPhotosForPublic(
      "portfolio",
      (payload.portfolio as Record<string, unknown>) || {}
    ),
    stylePosition: stripSectionPhotosForPublic(
      "stylePosition",
      (payload.stylePosition as Record<string, unknown>) || {}
    )
  } as T;
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

export async function getHomeSummary(): Promise<{
  modelCount: number;
  merchantCount: number;
  brokerCount: number;
}> {
  const [counts, offsets] = await Promise.all([countPublicHomeUsers(), getHomeStatOffsets()]);
  return {
    ...counts,
    modelCount: Math.max(0, counts.modelCount + offsets.model),
    merchantCount: Math.max(0, counts.merchantCount + offsets.merchant),
    brokerCount: Math.max(0, counts.brokerCount + offsets.broker)
  };
}

export type MerchantModelListQuery = {
  province?: unknown;
  city?: unknown;
  gender?: unknown;
  categoryId?: unknown;
  categoryIds?: unknown;
  category?: unknown;
  priceSort?: unknown;
  ratingSort?: unknown;
  modelLevel?: unknown;
  modelLevels?: unknown;
  preferPortfolio?: unknown;
  limit?: unknown;
};

function cleanText(value: unknown): string | undefined {
  const text = value == null ? "" : String(value).trim();
  return text || undefined;
}

function parseCategoryIds(value: unknown): number[] {
  if (value == null || value === "") return [];
  const rawList = Array.isArray(value) ? value : [value];
  const ids = rawList
    .flatMap((item) => String(item).split(","))
    .map((part) => Number(String(part).trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
}

function parseModelLevels(...values: unknown[]): number[] {
  const ids = values
    .filter((value) => value != null && value !== "")
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((item) => String(item).split(","))
    .map((part) => {
      const text = part.trim().toUpperCase();
      const normalized = text.startsWith("LV") ? text.slice(2) : text;
      return Number(normalized);
    })
    .filter((level) => Number.isInteger(level) && level >= 0 && level <= 5);
  return Array.from(new Set(ids));
}

function isTruthyQueryFlag(value: unknown): boolean {
  const text = cleanText(value);
  return text === "1" || text === "true" || text === "yes";
}

function toMerchantModelListFilters(query: MerchantModelListQuery = {}): MerchantModelListFilters {
  const genderText = cleanText(query.gender);
  const priceSort = cleanText(query.priceSort);
  const ratingSort = cleanText(query.ratingSort);
  const categoryId = Number(query.categoryId || 0);
  const categoryIds = parseCategoryIds(query.categoryIds);
  const modelLevels = parseModelLevels(query.modelLevel, query.modelLevels);
  const limit = Number(query.limit || 50);
  return {
    province: cleanText(query.province),
    city: cleanText(query.city),
    gender: genderText === "男" || genderText === "女" ? genderText : undefined,
    categoryId:
      categoryIds.length > 0
        ? undefined
        : Number.isInteger(categoryId) && categoryId > 0
          ? categoryId
          : undefined,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    category: cleanText(query.category),
    priceSort: priceSort === "asc" || priceSort === "desc" ? priceSort : undefined,
    ratingSort: ratingSort === "desc" ? "desc" : undefined,
    modelLevels: modelLevels.length > 0 ? modelLevels : undefined,
    preferPortfolio: isTruthyQueryFlag(query.preferPortfolio),
    limit: Number.isFinite(limit) ? limit : 50
  };
}

export async function getMerchantModelList(query: MerchantModelListQuery = {}): Promise<{
  list: Array<{
    userId: number;
    userNo: string;
    nickname: string;
    avatarUrl: string;
    city: string;
    gender: string;
    intro: string;
    price: {
      hourly: number | null;
      halfDay: number | null;
      fullDay: number | null;
    };
    ratingScore: number;
    categoryIds: number[];
    categories: string[];
    profileAuditStatus: number;
    isPlatformFeatured: boolean;
    modelLevel: ModelLevelInfo;
    /** 模卡：与详情页 /api/models/detail 中 card 结构一致 */
    card: {
      photoAngles: Array<{ key?: string; label?: string; url?: string }>;
      measurements: Record<string, unknown>;
    };
  }>;
}> {
  const rows = await findMerchantModelList(toMerchantModelListFilters(query));
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
      const portfolio = normalizePortfolioFromStorage(parseJsonField(row.portfolio_json), {
        stripNonRemoteUrls: true
      });
      const stylePosition = normalizeStylePositionFromStorage(parseJsonField(row.style_position_json));
      const card = { photoAngles, measurements };
      const isPlatformFeatured = Boolean(Number(row.is_platform_featured ?? 0));
      const publicBundle = stripModelPhotosForPublic(
        { card, portfolio, stylePosition },
        isPhotosDisabledFlag(row.photos_disabled)
      );
      const categoryIds = String(row.category_ids || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return {
        userId: row.id,
        userNo: row.user_no,
        nickname: row.nickname || `模特${row.user_no}`,
        avatarUrl: row.avatar_url != null ? String(row.avatar_url) : "",
        city: row.city || "",
        gender: row.profile_gender === 1 ? "男" : row.profile_gender === 2 ? "女" : "",
        intro: row.intro || "",
        price: {
          hourly: row.price_hour,
          halfDay: row.price_halfday,
          fullDay: row.price_allday
        },
        ratingScore: Number(row.rating_score || 5),
        categoryIds,
        categories: String(row.category_names || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        profileAuditStatus: Number(row.profile_audit_status || 0),
        isPlatformFeatured,
        modelLevel: buildModelLevel({
          card: publicBundle.card as Record<string, unknown>,
          portfolio: publicBundle.portfolio as { folders: unknown[]; photos: unknown[] },
          stylePosition: publicBundle.stylePosition as { photos: unknown[] },
          modelLevelOverride: row.model_level_override,
          profileAuditStatus: row.profile_audit_status,
          isPlatformFeatured
        }),
        card: publicBundle.card as typeof card
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

type StylePositionPhoto = {
  id: string;
  url: string;
  reviewStatus?: number;
  rejectReason?: string;
};

function normalizeStylePositionPhoto(
  row: Record<string, unknown>,
  fallbackId: string
): StylePositionPhoto | null {
  const url = String(row.url || "").trim();
  if (!url) return null;
  const next: StylePositionPhoto = {
    id: String(row.id || fallbackId).slice(0, 80),
    url
  };
  const reviewStatusRaw = row.reviewStatus;
  if (reviewStatusRaw != null && Number.isFinite(Number(reviewStatusRaw))) {
    next.reviewStatus = Number(reviewStatusRaw);
  }
  const rejectReason = row.rejectReason != null ? String(row.rejectReason).trim() : "";
  if (rejectReason) next.rejectReason = rejectReason;
  return next;
}

function normalizeStylePositionFromStorage(value: unknown): { photos: StylePositionPhoto[] } {
  const parsed = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawPhotos = Array.isArray(parsed.photos) ? parsed.photos : [];
  return {
    photos: rawPhotos
      .filter((item) => item && typeof item === "object")
      .map((item, index) => normalizeStylePositionPhoto(item as Record<string, unknown>, `style_${index}`))
      .filter((item): item is StylePositionPhoto => Boolean(item))
      .slice(0, 100)
  };
}

function normalizeStylePositionForPersist(payload: Record<string, unknown>): { photos: StylePositionPhoto[] } {
  const rawPhotos = Array.isArray(payload.photos) ? payload.photos : [];
  return {
    photos: rawPhotos
      .filter((item) => item && typeof item === "object")
      .map((item, index) =>
        normalizeStylePositionPhoto(
          item as Record<string, unknown>,
          `style_${Date.now()}_${index}`
        )
      )
      .filter((item): item is StylePositionPhoto => Boolean(item))
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

  const card = parseJsonField(row.card_json) || { photoAngles: [], measurements: {} };
  const portfolio = normalizePortfolioFromStorage(parseJsonField(row.portfolio_json), {
    stripNonRemoteUrls: true
  });
  const stylePosition = normalizeStylePositionFromStorage(parseJsonField(row.style_position_json));
  const enrichedCard = enrichCardFromProfile(card, {
    height: row.height,
    weight: row.weight,
    bust: row.bust,
    waist: row.waist,
    hip: row.hip,
    shoe_size: row.shoe_size,
    hair_color: row.hair_color,
    skin_tone: row.skin_tone
  });
  const isPlatformFeatured = Boolean(Number(row.is_platform_featured ?? 0));
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
  const honors = await listHonorsForPublicDisplay(row.id);

  const publicBundle = stripModelPhotosForPublic(
    { card: enrichedCard, portfolio, stylePosition },
    isPhotosDisabledFlag(row.photos_disabled)
  );
  const publicCard = publicBundle.card as Record<string, unknown>;
  const publicPortfolio = publicBundle.portfolio as { folders: unknown[]; photos: unknown[] };
  const publicStylePosition = publicBundle.stylePosition as { photos: unknown[] };

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
    isPlatformFeatured,
    modelLevel: buildModelLevel({
      card: publicCard,
      portfolio: publicPortfolio,
      stylePosition: publicStylePosition,
      modelLevelOverride: row.model_level_override,
      profileAuditStatus: row.profile_audit_status,
      isPlatformFeatured
    }),
    card: publicCard,
    portfolio: publicPortfolio,
    stylePosition: publicStylePosition,
    honors,
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

  const [profile, extra, userRow] = await Promise.all([
    findModelProfile(userId),
    findModelExtra(userId),
    findUserProfileById(userId)
  ]);

  const categoryIds = await findMyCategoryIds(userId);
  const cardRaw =
    (parseJsonColumn(extra?.card_json) as Record<string, unknown> | null) || { photoAngles: [], measurements: {} };
  const cardEnriched = enrichCardFromProfile(cardRaw, profile);
  const card = materializeLegacyPhotoReviewsInPayload(
    "card",
    cardEnriched,
    extra?.card_review_status
  );
  const portfolio = materializeLegacyPhotoReviewsInPayload(
    "portfolio",
    normalizePortfolioFromStorage(parseJsonColumn(extra?.portfolio_json), {
      stripNonRemoteUrls: false
    }) as Record<string, unknown>,
    extra?.portfolio_review_status
  );
  const stylePosition = materializeLegacyPhotoReviewsInPayload(
    "stylePosition",
    normalizeStylePositionFromStorage(parseJsonColumn(extra?.style_position_json)) as Record<
      string,
      unknown
    >,
    extra?.style_position_review_status
  );
  const isPlatformFeatured = Boolean(Number(profile?.is_platform_featured ?? 0));
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
  const honors = await listHonorsForPublicDisplay(userId);

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
    isPlatformFeatured,
    modelLevel: buildModelLevel({
      card,
      portfolio,
      stylePosition,
      modelLevelOverride: profile?.model_level_override,
      profileAuditStatus: userRow?.profile_audit_status ?? 0,
      isPlatformFeatured
    }),
    card,
    portfolio,
    stylePosition,
    honors,
    schedule,
    orderSettings,
    contentReview: buildContentReviewState(
      card as Record<string, unknown>,
      portfolio as Record<string, unknown>,
      stylePosition as Record<string, unknown>
    )
  };
}

export type SaveModelContentOptions = {
  autoApprove?: boolean;
  /** 后管显式清空模卡/作品/风格照片时为 true；默认不允许一次保存抹掉全部已有照片 */
  allowClearAllPhotos?: boolean;
};

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

function parseStoredExtraPayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (Buffer.isBuffer(raw)) {
    try {
      const parsed = JSON.parse(raw.toString("utf8")) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function saveCard(
  userId: number,
  payload: Record<string, unknown>,
  options?: SaveModelContentOptions
): Promise<void> {
  await ensureModelProfile(userId);
  await ensureModelExtra(userId);
  const extra = await findModelExtra(userId);
  const oldPayload = parseStoredExtraPayload(extra?.card_json);
  const merged = mergeSectionPhotoReviewsOnSave("card", oldPayload, payload, options);
  const oldPhotoCount = extractSectionPhotos("card", oldPayload).filter((photo) =>
    String(photo.url || "").trim()
  ).length;
  const mergedPhotoCount = extractSectionPhotos("card", merged).filter((photo) =>
    String(photo.url || "").trim()
  ).length;
  if (oldPhotoCount > 0 && mergedPhotoCount === 0 && !options?.allowClearAllPhotos) {
    throw new AppError("不能清空已有模卡照片", 409, ErrorCodes.CONFLICT);
  }
  const derived = deriveSectionReviewFromPhotos(extractSectionPhotos("card", merged));
  await updateModelExtraSectionWithReview(
    userId,
    "card",
    merged,
    derived.status,
    derived.rejectReason
  );
  await syncModelProfileFromCard(userId, payload);
}

export async function savePortfolio(
  userId: number,
  payload: Record<string, unknown>,
  options?: SaveModelContentOptions
): Promise<void> {
  await ensureModelExtra(userId);
  const extra = await findModelExtra(userId);
  const canonical = normalizePortfolioForPersist(payload);
  const oldPayload = parseStoredExtraPayload(extra?.portfolio_json);
  const merged = mergeSectionPhotoReviewsOnSave("portfolio", oldPayload, canonical, options);
  const derived = deriveSectionReviewFromPhotos(extractSectionPhotos("portfolio", merged));
  await updateModelExtraSectionWithReview(
    userId,
    "portfolio",
    merged,
    derived.status,
    derived.rejectReason
  );
}

export async function saveStylePosition(
  userId: number,
  payload: Record<string, unknown>,
  options?: SaveModelContentOptions
): Promise<void> {
  await ensureModelExtra(userId);
  const extra = await findModelExtra(userId);
  const canonical = normalizeStylePositionForPersist(payload);
  const oldPayload = parseStoredExtraPayload(extra?.style_position_json);
  const merged = mergeSectionPhotoReviewsOnSave("stylePosition", oldPayload, canonical, options);
  const derived = deriveSectionReviewFromPhotos(extractSectionPhotos("stylePosition", merged));
  await updateModelExtraSectionWithReview(
    userId,
    "stylePosition",
    merged,
    derived.status,
    derived.rejectReason
  );
}

export async function approveAllModelContentForAdmin(userId: number): Promise<void> {
  await approveAllModelContentReviewForAdmin(userId);
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

function hasAtLeastOneCardPhoto(card: Record<string, unknown>): boolean {
  const items = Array.isArray(card.photoAngles) ? card.photoAngles : [];
  return items.some((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as Record<string, unknown>).url || "").trim().length > 0;
  });
}

function isPlatformModelContractSigned(
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
  const cardDone = hasAtLeastOneCardPhoto(cardPayload);
  const pricingDone = profile ? isModelPricingCompleteForAudit(profile) : false;
  const contractDone = isPlatformModelContractSigned(userRow);
  const realnameDone = isModelRealnameVerified(userRow.verified_status);

  const items: ProfileAuditReadinessItem[] = [
    { key: "realname", label: "实名认证", done: realnameDone },
    { key: "basicInfo", label: "基本信息", done: basicDone },
    { key: "categories", label: "模特分类", done: categoriesDone },
    { key: "card", label: "模卡", done: cardDone },
    { key: "pricing", label: "服务价格设置", done: pricingDone },
    { key: "contract", label: "平台与模特合同签署", done: contractDone }
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

  if (!isModelRealnameVerified(userRow.verified_status)) {
    throw new AppError("请先完成实名认证（上传身份证正反面）后再提交资料审核", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const readiness = await getProfileAuditReadiness(userId);
  if (!readiness.allDone) {
    throw new AppError("请先完成实名认证、基本信息、模特分类、模卡、服务价格及合同签署后再提交", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const updated = await trySetModelProfileAuditPending(userId);
  if (!updated) {
    throw new AppError("提交失败，请稍后重试", 409, ErrorCodes.CONFLICT);
  }
}
