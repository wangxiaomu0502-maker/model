/** 经纪人推广：链接参数名（打开小程序时携带） */
const BROKER_QUERY_KEY = "brokerUserNo";

const STORAGE_PENDING_BROKER = "xinglian_pending_broker_user_no";

/** 平台 user_no（Base62，当前为 12 位） */
const USER_NO_RE = /^[0-9A-Za-z]{8,16}$/;

/** 小程序启动页路径（不含前导 /） */
function buildBrokerPromoPagePath(userNo) {
  const no = String(userNo || "").trim();
  if (!no) return "pages/loading/loading";
  return `pages/loading/loading?${BROKER_QUERY_KEY}=${encodeURIComponent(no)}`;
}

function decodeEntryValue(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s).trim();
  } catch (_e) {
    return s;
  }
}

function parseSceneString(sceneRaw) {
  const scene = decodeEntryValue(sceneRaw);
  if (!scene) return "";

  const params = {};
  scene.split("&").forEach((part) => {
    const [k, ...rest] = String(part || "").split("=");
    const key = String(k || "").trim().toLowerCase();
    if (!key) return;
    params[key] = rest.join("=").trim();
  });

  const fromKey = params.brokeruserno || params.b || "";
  if (fromKey) return fromKey;

  if (!scene.includes("=") && USER_NO_RE.test(scene)) {
    return scene;
  }

  return "";
}

/**
 * 从页面 onLoad 参数或启动 query 中解析经纪人 user_no。
 * 链接：?brokerUserNo=xxx；小程序码：scene 为 userNo 或 brokerUserNo=xxx（微信可能拆成独立 query）。
 */
function extractBrokerUserNoFromEntry(entry) {
  const e = entry || {};
  const query = e.query || {};

  const direct =
    e.brokerUserNo != null
      ? decodeEntryValue(e.brokerUserNo)
      : query.brokerUserNo != null
        ? decodeEntryValue(query.brokerUserNo)
        : "";
  if (direct) return direct;

  const sceneRaw =
    e.scene != null ? String(e.scene) : query.scene != null ? String(query.scene) : "";
  return parseSceneString(sceneRaw);
}

function getMiniProgramEntryOptions() {
  try {
    if (typeof wx.getEnterOptionsSync === "function") {
      return wx.getEnterOptionsSync();
    }
  } catch (_e) {
    /* ignore */
  }
  try {
    if (typeof wx.getLaunchOptionsSync === "function") {
      return wx.getLaunchOptionsSync();
    }
  } catch (_e) {
    /* ignore */
  }
  return {};
}

function capturePendingBrokerFromEntry(entry) {
  let userNo = extractBrokerUserNoFromEntry(entry);
  if (!userNo) {
    const launch = getMiniProgramEntryOptions();
    userNo = extractBrokerUserNoFromEntry({ query: launch.query || {} });
  }
  if (userNo) {
    savePendingBrokerUserNo(userNo);
  }
  return userNo;
}

function savePendingBrokerUserNo(userNo) {
  const no = String(userNo || "").trim();
  if (!no) return;
  try {
    wx.setStorageSync(STORAGE_PENDING_BROKER, no);
  } catch (_e) {
    /* ignore */
  }
}

function readPendingBrokerUserNo() {
  try {
    return String(wx.getStorageSync(STORAGE_PENDING_BROKER) || "").trim();
  } catch (_e) {
    return "";
  }
}

function clearPendingBrokerUserNo() {
  try {
    wx.removeStorageSync(STORAGE_PENDING_BROKER);
  } catch (_e) {
    /* ignore */
  }
}

module.exports = {
  BROKER_QUERY_KEY,
  STORAGE_PENDING_BROKER,
  buildBrokerPromoPagePath,
  decodeEntryValue,
  parseSceneString,
  extractBrokerUserNoFromEntry,
  getMiniProgramEntryOptions,
  capturePendingBrokerFromEntry,
  savePendingBrokerUserNo,
  readPendingBrokerUserNo,
  clearPendingBrokerUserNo
};
