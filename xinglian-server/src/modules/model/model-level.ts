export type ModelLevelInfo = {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  code: "LV0" | "LV1" | "LV2" | "LV3" | "LV4" | "LV5";
  name: string;
  temperament: string;
  requirement: string;
  source: "auto" | "admin";
};

/** 后管手动指定的模特等级（LV2 及以上须人工设置） */
export type AdminModelLevelOverride = 2 | 3 | 4 | 5;

export function isAdminModelLevelOverride(value: unknown): value is AdminModelLevelOverride {
  const n = Number(value);
  return n === 2 || n === 3 || n === 4 || n === 5;
}

export function parseAdminModelLevelOverride(value: unknown): AdminModelLevelOverride | null {
  const n = Number(value);
  if (n === 2 || n === 3 || n === 4 || n === 5) {
    return n as AdminModelLevelOverride;
  }
  return null;
}

const MODEL_LEVELS: Record<ModelLevelInfo["level"], Omit<ModelLevelInfo, "level" | "code" | "source">> = {
  0: {
    name: "初星模特",
    requirement: "完成账号注册",
    temperament: "刚被看见"
  },
  1: {
    name: "新锐模特",
    requirement: "完成基础模卡信息",
    temperament: "开始崭露头角"
  },
  2: {
    name: "风暴模特",
    requirement: "平台管理员手动升级",
    temperament: "风格鲜明，有记忆点"
  },
  3: {
    name: "星芒模特",
    requirement: "平台管理员手动升级",
    temperament: "作品成型，具备展示力"
  },
  4: {
    name: "皇冠模特",
    requirement: "完成全部资料 + 平台管理员认证/授权",
    temperament: "平台认证，具备权威背书"
  },
  5: {
    name: "天幕模特",
    requirement: "完成全部资料 + 平台认证 + 平台优选/重点推荐",
    temperament: "平台顶级优选，重点推荐"
  }
};

function hasNonEmptyValue(value: unknown): boolean {
  return value != null && String(value).trim() !== "";
}

function hasModelCardInfo(card: unknown): boolean {
  if (!card || typeof card !== "object" || Array.isArray(card)) return false;
  const obj = card as Record<string, unknown>;
  const angles = Array.isArray(obj.photoAngles) ? obj.photoAngles : [];
  if (
    angles.some((item) => {
      if (!item || typeof item !== "object") return false;
      return hasNonEmptyValue((item as Record<string, unknown>).url);
    })
  ) {
    return true;
  }
  const measurements =
    obj.measurements && typeof obj.measurements === "object" && !Array.isArray(obj.measurements)
      ? (obj.measurements as Record<string, unknown>)
      : {};
  return (
    Object.values(measurements).some(hasNonEmptyValue) ||
    hasNonEmptyValue(obj.hairColor) ||
    hasNonEmptyValue(obj.skinColor)
  );
}

function hasStylePosition(stylePosition: unknown): boolean {
  if (!stylePosition || typeof stylePosition !== "object" || Array.isArray(stylePosition)) return false;
  const photos = Array.isArray((stylePosition as Record<string, unknown>).photos)
    ? ((stylePosition as Record<string, unknown>).photos as unknown[])
    : [];
  return photos.some((item) => item && typeof item === "object" && hasNonEmptyValue((item as Record<string, unknown>).url));
}

function hasPortfolio(portfolio: unknown): boolean {
  if (!portfolio || typeof portfolio !== "object" || Array.isArray(portfolio)) return false;
  const photos = Array.isArray((portfolio as Record<string, unknown>).photos)
    ? ((portfolio as Record<string, unknown>).photos as unknown[])
    : [];
  return photos.some((item) => item && typeof item === "object" && hasNonEmptyValue((item as Record<string, unknown>).url));
}

export function buildModelLevel(input: {
  card?: unknown;
  stylePosition?: unknown;
  portfolio?: unknown;
  modelLevelOverride?: unknown;
  profileAuditStatus?: unknown;
  isPlatformFeatured?: unknown;
}): ModelLevelInfo {
  const override = Number(input.modelLevelOverride);
  if (isAdminModelLevelOverride(override)) {
    const meta = MODEL_LEVELS[override];
    return {
      level: override,
      code: `LV${override}` as ModelLevelInfo["code"],
      source: "admin",
      ...meta
    };
  }

  const hasCard = hasModelCardInfo(input.card);

  const level: 0 | 1 = hasCard ? 1 : 0;

  const meta = MODEL_LEVELS[level];
  return {
    level,
    code: `LV${level}` as ModelLevelInfo["code"],
    source: "auto",
    ...meta
  };
}
