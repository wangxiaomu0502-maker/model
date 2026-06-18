import { env } from "../../config/env";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

/** 微信 URL Link：expire_type=1 时 expire_interval 最大天数（官方上限 30，不可永久） */
export const WECHAT_URL_LINK_MAX_EXPIRE_DAYS = 30;

const RETRIABLE_WECHAT_NETWORK_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "EPIPE", "ECONNREFUSED"]);

function isRetriableWechatNetworkError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code != null && RETRIABLE_WECHAT_NETWORK_CODES.has(code);
}

/** 避免 undici 复用失效连接导致 read ETIMEDOUT；网络抖动时自动重试一次 */
export async function wechatFetch(
  url: string,
  init: RequestInit = {},
  retries = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const headers = new Headers(init.headers);
      headers.set("Connection", "close");
      return await fetch(url, { ...init, headers });
    } catch (error) {
      lastError = error;
      if (!isRetriableWechatNetworkError(error) || attempt === retries - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}

let cachedAccessToken = "";
let cachedAccessTokenExpireAt = 0;

export async function getWechatAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < cachedAccessTokenExpireAt) {
    return cachedAccessToken;
  }

  let response: Response;
  try {
    response = await wechatFetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: env.wechat.appId,
        secret: env.wechat.appSecret,
        force_refresh: forceRefresh
      })
    });
  } catch (error) {
    throw new AppError(
      isRetriableWechatNetworkError(error)
        ? "微信服务连接超时，请稍后重试"
        : `get wechat access_token failed: ${(error as Error).message}`,
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }
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

function invalidateWechatAccessToken(): void {
  cachedAccessToken = "";
  cachedAccessTokenExpireAt = 0;
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

export type GenerateUnlimitedWxacodeParams = {
  page: string;
  scene: string;
  width?: number;
  envVersion?: "release" | "trial" | "develop";
};

export async function generateWechatUrlLink(
  params: GenerateUrlLinkParams
): Promise<GenerateUrlLinkResult> {
  const rawDays = params.expireDays ?? WECHAT_URL_LINK_MAX_EXPIRE_DAYS;
  const expireDays = Math.min(
    WECHAT_URL_LINK_MAX_EXPIRE_DAYS,
    Math.max(1, Math.floor(rawDays))
  );

  let accessToken = await getWechatAccessToken();
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

  async function requestUrlLink(token: string) {
    return wechatFetch(`https://api.weixin.qq.com/wxa/generate_urllink?access_token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  let response = await requestUrlLink(accessToken);
  let result = (await response.json()) as {
    errcode?: number;
    errmsg?: string;
    url_link?: string;
  };

  if (result.errcode === 40001) {
    invalidateWechatAccessToken();
    accessToken = await getWechatAccessToken(true);
    response = await requestUrlLink(accessToken);
    result = (await response.json()) as {
      errcode?: number;
      errmsg?: string;
      url_link?: string;
    };
  }

  if (result.errcode !== 0 || !result.url_link) {
    throw new AppError(
      `生成 URL Link 失败：${result.errmsg ?? "未知错误"}（${result.errcode ?? ""}）`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  return { urlLink: result.url_link, expireDays };
}

export async function generateUnlimitedWxacode(
  params: GenerateUnlimitedWxacodeParams
): Promise<Buffer> {
  const scene = String(params.scene || "").trim();
  if (!scene) {
    throw new AppError("小程序码参数不能为空", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (scene.length > 32) {
    throw new AppError("小程序码参数过长", 400, ErrorCodes.VALIDATION_ERROR);
  }

  let accessToken = await getWechatAccessToken();
  const page = params.page.replace(/^\//, "");
  const body = {
    scene,
    page,
    check_path: false,
    env_version: params.envVersion ?? env.wechat.miniProgramEnv,
    width: Math.min(1280, Math.max(280, Math.floor(params.width ?? 430)))
  };

  async function requestWxacode(token: string) {
    return wechatFetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  let response = await requestWxacode(accessToken);
  let arrayBuffer = await response.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    let result: { errcode?: number; errmsg?: string } = {};
    try {
      result = JSON.parse(buffer.toString("utf8")) as { errcode?: number; errmsg?: string };
    } catch {
      // keep empty result
    }
    if (result.errcode === 40001) {
      invalidateWechatAccessToken();
      accessToken = await getWechatAccessToken(true);
      response = await requestWxacode(accessToken);
      arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const retryContentType = response.headers.get("content-type") || "";
      if (!retryContentType.includes("application/json") && response.ok && buffer.length > 0) {
        return buffer;
      }
      try {
        result = JSON.parse(buffer.toString("utf8")) as { errcode?: number; errmsg?: string };
      } catch {
        result = {};
      }
    }
    throw new AppError(
      `生成小程序码失败：${result.errmsg ?? "未知错误"}（${result.errcode ?? ""}）`.trim(),
      502,
      ErrorCodes.UPSTREAM_ERROR
    );
  }

  if (!response.ok || buffer.length === 0) {
    throw new AppError("生成小程序码失败", 502, ErrorCodes.UPSTREAM_ERROR);
  }

  return buffer;
}
