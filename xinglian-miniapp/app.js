import { initEid } from "./mp_ecard_sdk/main";

const { capturePendingBrokerFromEntry } = require("./utils/broker-promo.js");
const { installGlobalLoadingShare } = require("./utils/loading-share.js");

installGlobalLoadingShare();

/** 线上 API */
const PROD_API_BASE = "https://api.xinglianmoku.cn";

/** 本地后端，与 xinglian-server env.PORT 一致 */
const DEFAULT_LOCAL_API_BASE = "http://127.0.0.1:3000";

/**
 * 开发时手动切换 API（改此常量后重新编译/预览）：
 * - "prod"  → 一律连线上 https://api.xinglianmoku.cn
 * - "local" → 一律连本地（见 DEFAULT_LOCAL_API_BASE 或 storage xinglian_local_api_base）
 * - "auto"  → 体验版/正式版线上；开发版模拟器本地、真机预览线上
 */
const API_ENV_OVERRIDE = "prod";

const STORAGE_LOCAL_API_BASE = "xinglian_local_api_base";

function getMiniProgramEnvVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || "release";
  } catch (_e) {
    return "release";
  }
}

/** 微信开发者工具模拟器：platform 为 devtools；真机为 ios / android */
function isWechatDevtools() {
  try {
    return wx.getSystemInfoSync().platform === "devtools";
  } catch (_e) {
    return false;
  }
}

function normalizeApiBase(url) {
  const s = String(url || "").trim().replace(/\/+$/, "");
  return s || DEFAULT_LOCAL_API_BASE;
}

function resolveLocalApiBase() {
  try {
    const custom = wx.getStorageSync(STORAGE_LOCAL_API_BASE);
    const raw = String(custom || "").trim();
    return normalizeApiBase(raw || DEFAULT_LOCAL_API_BASE);
  } catch (_e) {
    return normalizeApiBase(DEFAULT_LOCAL_API_BASE);
  }
}

/**
 * API 环境（API_ENV_OVERRIDE === "auto" 时）：
 * - 体验版 / 正式版：一律线上
 * - 开发版 + 开发者工具模拟器：本地
 * - 开发版 + 真机预览：线上
 */
function resolveApiBaseUrl() {
  if (API_ENV_OVERRIDE === "prod") {
    return PROD_API_BASE;
  }
  if (API_ENV_OVERRIDE === "local") {
    return resolveLocalApiBase();
  }

  const mpEnv = getMiniProgramEnvVersion();
  if (mpEnv === "trial" || mpEnv === "release") {
    return PROD_API_BASE;
  }
  if (isWechatDevtools()) {
    return resolveLocalApiBase();
  }
  return PROD_API_BASE;
}

App({
  PROD_API_BASE,
  DEFAULT_LOCAL_API_BASE,
  STORAGE_LOCAL_API_BASE,
  API_ENV_OVERRIDE,

  getApiBaseUrlByEnv() {
    return resolveApiBaseUrl();
  },

  refreshApiBaseFromStorage() {
    const url = resolveApiBaseUrl();
    this.globalData.apiBaseUrl = url;
    return url;
  },

  /** 头像未接腾讯云 COS 前写入 users.avatar_url 的占位值，接入 COS 后改为真实 URL */
  COS_AVATAR_PLACEHOLDER: "cos:pending",

  /** 未接入身份证 OCR 前写入 users.real_name / id_card_no 的占位值 */
  OCR_PENDING_REAL_NAME: "待OCR核验",
  OCR_PENDING_ID_CARD_NO: "000000000000000000",

  resolveAvatarUrl(stored, apiBase) {
    const pending = this.COS_AVATAR_PLACEHOLDER;
    if (!stored || stored === pending) {
      return "/assets/logo/logo.png";
    }
    if (/^https?:\/\//i.test(stored)) {
      return stored;
    }
    const b = String(apiBase || PROD_API_BASE).replace(/\/$/, "");
    const p = stored.startsWith("/") ? stored : `/${stored}`;
    return `${b}${p}`;
  },

  getIdentityByRole(role) {
    const map = {
      0: "游客",
      1: "模特",
      2: "客户",
      3: "经纪人",
      4: "代理人",
      5: "管理员"
    };
    return map[Number(role)] || "游客";
  },

  globalData: {
    openId: "",
    userId: null,
    userNo: "",
    role: 0,
    token: "",
    userInfo: null,
    identity: "",
    apiBaseUrl: resolveApiBaseUrl()
  },

  onLaunch() {
    // 体验版也固定跳腾讯 E证通正式版，避免目标小程序体验权限限制。
    initEid(undefined, "release");
    capturePendingBrokerFromEntry({});

    const savedRole = Number(wx.getStorageSync("selectedRole") || 0);
    const savedToken = wx.getStorageSync("authToken");
    this.globalData.role = savedRole;
    this.globalData.identity = this.getIdentityByRole(savedRole);
    if (savedToken) {
      this.globalData.token = savedToken;
    }
    this.globalData.apiBaseUrl = resolveApiBaseUrl();
    let plat = "";
    try {
      plat = wx.getSystemInfoSync().platform || "";
    } catch (_e) {}
    console.log(
      "[xinglian] api:",
      this.globalData.apiBaseUrl,
      "| override=",
      API_ENV_OVERRIDE,
      "| platform=",
      plat,
      "| mpEnv=",
      getMiniProgramEnvVersion()
    );
  },

  onShow() {
    capturePendingBrokerFromEntry({});
  }
});
