import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import {
  findBrokerPublicDetailByUserNo,
  findMerchantPublicDetailByUserNo,
  searchPublicUsers
} from "./search.repository";

const ROLE_TYPE_MAP: Record<number, "model" | "broker" | "merchant"> = {
  1: "model",
  2: "merchant",
  3: "broker"
};

const ROLE_LABEL_MAP: Record<number, string> = {
  1: "模特",
  2: "商家",
  3: "经纪人"
};

function cleanText(value: string | null | undefined): string {
  return value == null ? "" : String(value).trim();
}

function roleToType(role: number): "model" | "broker" | "merchant" | null {
  return ROLE_TYPE_MAP[role] ?? null;
}

export async function searchUsersByKeyword(keyword: string, limit = 30) {
  const kw = keyword.trim();
  if (!kw) {
    return { list: [] as Array<Record<string, unknown>>, keyword: "" };
  }
  const rows = await searchPublicUsers(kw, limit);
  const list = rows
    .map((row) => {
      const role = Number(row.role);
      const type = roleToType(role);
      if (!type) return null;
      const nickname = cleanText(row.nickname) || cleanText(row.real_name) || "未命名";
      const city = cleanText(row.city);
      const subtitle =
        type === "broker"
          ? city || (Number(row.is_professional) === 1 ? "专业经纪人" : "平台经纪人")
          : city || ROLE_LABEL_MAP[role] || "";
      return {
        type,
        typeLabel: ROLE_LABEL_MAP[role] || "",
        userNo: row.user_no,
        nickname,
        avatarUrl: cleanText(row.avatar_url),
        city,
        subtitle
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
  return { keyword: kw, list };
}

export async function getBrokerPublicDetail(userNo: string) {
  const row = await findBrokerPublicDetailByUserNo(userNo);
  if (!row) {
    throw new AppError("经纪人不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const nickname = cleanText(row.nickname) || cleanText(row.broker_real_name) || "未命名";
  return {
    userNo: row.user_no,
    nickname,
    avatarUrl: cleanText(row.avatar_url),
    realName: cleanText(row.broker_real_name),
    isProfessional: Number(row.broker_is_professional) === 1,
    boundMerchantCount: Number(row.bound_merchant_count ?? 0),
    joinedAt: row.created_at
  };
}

export async function getMerchantPublicDetail(userNo: string) {
  const row = await findMerchantPublicDetailByUserNo(userNo);
  if (!row) {
    throw new AppError("商家不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const nickname = cleanText(row.nickname) || "未命名";
  const brokerNickname =
    cleanText(row.referrer_broker_nickname) || cleanText(row.referrer_broker_real_name);
  return {
    userNo: row.user_no,
    nickname,
    avatarUrl: cleanText(row.avatar_url),
    city: cleanText(row.city),
    broker:
      row.referrer_broker_user_no && brokerNickname
        ? {
            userNo: row.referrer_broker_user_no,
            nickname: brokerNickname
          }
        : null,
    joinedAt: row.created_at
  };
}
