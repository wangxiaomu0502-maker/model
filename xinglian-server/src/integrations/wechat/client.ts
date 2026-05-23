import { env } from "../../config/env";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

/** 微信 URL Link：expire_type=1 时 expire_interval 最大天数（官方上限 30，不可永久） */
export const WECHAT_URL_LINK_MAX_EXPIRE_DAYS = 30;

let cachedAccessToken = "";
let cachedAccessTokenExpireAt = 0;

export async function getWechatAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessTokenExpireAt) {
    return cachedAccessToken;
  }

  const query = new URLSearchParams({
    grant_type: "client_credential",
    appid: env.wechat.appId,
    secret: env.wechat.appSecret
  });

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?${query.toString()}`,
    { method: "GET" }
  );
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!response.ok || !result.access_token || !result.expires_in) {
    throw new AppError(
      `get wechat access_token failed: ${result.errcode ?? ""} ${result.errmsg ?? ""}`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  cachedAccessToken = result.access_token;
  cachedAccessTokenExpireAt = now + (result.expires_in - 300) * 1000;
  return cachedAccessToken;
}

export type GenerateUrlLinkParams = {
  path: string;
  query?: string;
  /** 有效天数 1–30，默认 30 */
  expireDays?: number;
  envVersion?: "release" | "trial" | "develop";
};

export type GenerateUrlLinkResult = {
  urlLink: string;
  expireDays: number;
};

export async function generateWechatUrlLink(
  params: GenerateUrlLinkParams
): Promise<GenerateUrlLinkResult> {
  const rawDays = params.expireDays ?? WECHAT_URL_LINK_MAX_EXPIRE_DAYS;
  const expireDays = Math.min(
    WECHAT_URL_LINK_MAX_EXPIRE_DAYS,
    Math.max(1, Math.floor(rawDays))
  );

  const accessToken = await getWechatAccessToken();
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const body: Record<string, string | number> = {
    path,
    expire_type: 1,
    expire_interval: expireDays,
    env_version: params.envVersion ?? env.wechat.miniProgramEnv
  };
  const query = String(params.query ?? "").trim().replace(/^\?/, "");
  if (query) {
    body.query = query;
  }

  const response = await fetch(
    `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const result = (await response.json()) as {
    errcode?: number;
    errmsg?: string;
    url_link?: string;
  };

  if (result.errcode !== 0 || !result.url_link) {
    throw new AppError(
      `生成 URL Link 失败：${result.errmsg ?? "未知错误"}（${result.errcode ?? ""}）`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  return { urlLink: result.url_link, expireDays };
}
