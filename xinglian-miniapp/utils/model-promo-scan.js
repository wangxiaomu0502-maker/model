const { decodeEntryValue } = require("./broker-promo.js");

const MODEL_DETAIL_PAGE = "pages/model-detail/model-detail";
const MODEL_SCENE_PREFIX = "md_";
const USER_NO_RE = /^[0-9A-Za-z]{8,16}$/;

function parseQueryString(query) {
  const params = {};
  String(query || "")
    .split("&")
    .forEach((part) => {
      const [k, ...rest] = String(part || "").split("=");
      const key = String(k || "").trim().toLowerCase();
      if (!key) return;
      params[key] = decodeEntryValue(rest.join("="));
    });
  return params;
}

function parseModelScene(sceneRaw) {
  const scene = decodeEntryValue(sceneRaw);
  if (!scene) return "";

  if (scene.startsWith(MODEL_SCENE_PREFIX)) {
    const userNo = scene.slice(MODEL_SCENE_PREFIX.length);
    if (USER_NO_RE.test(userNo)) return userNo;
    return "";
  }

  const params = {};
  scene.split("&").forEach((part) => {
    const [k, ...rest] = String(part || "").split("=");
    const key = String(k || "").trim().toLowerCase();
    if (!key) return;
    params[key] = decodeEntryValue(rest.join("="));
  });

  const fromKey = params.modeluserno || params.userno || params.m || "";
  if (fromKey) return fromKey;

  return "";
}

function extractModelPromoUserNoFromEntry(entry) {
  const e = entry || {};
  const query = e.query || {};
  const sceneRaw =
    e.scene != null ? String(e.scene) : query.scene != null ? String(query.scene) : "";
  return parseModelScene(sceneRaw);
}

function extractModelUserNoFromPath(path) {
  const normalized = String(path || "").trim().replace(/^\//, "");
  if (!normalized.includes("model-detail")) return "";

  const query = normalized.includes("?") ? normalized.split("?").slice(1).join("?") : "";
  const params = parseQueryString(query);
  if (params.userno) return params.userno;
  if (params.scene) {
    const fromScene = parseModelScene(params.scene);
    if (fromScene) return fromScene;
  }
  return "";
}

function extractModelUserNoFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const fromPromoScene = parseModelScene(raw);
  if (fromPromoScene) return fromPromoScene;

  if (raw.includes("model-detail")) {
    const fromPath = extractModelUserNoFromPath(raw);
    if (fromPath) return fromPath;
  }

  if (raw.includes("userNo=") || raw.includes("modelUserNo=")) {
    const query = raw.includes("?") ? raw.split("?").slice(1).join("?") : raw;
    const params = parseQueryString(query);
    if (params.userno || params.modeluserno) {
      return params.userno || params.modeluserno;
    }
  }

  return "";
}

function extractModelUserNoFromScan(res) {
  const path = String(res?.path || "").trim();

  if (path.includes("loading")) {
    const query = path.includes("?") ? path.split("?").slice(1).join("?") : "";
    const params = parseQueryString(query);
    const fromScene = parseModelScene(params.scene || "");
    if (fromScene) return fromScene;
    return "";
  }

  const fromPath = extractModelUserNoFromPath(path);
  if (fromPath) return fromPath;

  const result = String(res?.result || "").trim();
  if (!result) return "";

  return extractModelUserNoFromText(result);
}

function extractModelUserNoFromEntry(entry) {
  const e = entry || {};
  const query = e.query || {};

  const direct =
    e.userNo != null
      ? decodeEntryValue(e.userNo)
      : query.userNo != null
        ? decodeEntryValue(query.userNo)
        : "";
  if (direct) return direct;

  const fromPromoScene = extractModelPromoUserNoFromEntry(entry);
  if (fromPromoScene) return fromPromoScene;

  return "";
}

function openModelDetailByUserNo(userNo) {
  const no = String(userNo || "").trim();
  if (!no) {
    wx.showToast({ title: "未识别到模特二维码", icon: "none" });
    return;
  }
  wx.navigateTo({
    url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(no)}`
  });
}

function scanAndOpenModelDetail() {
  wx.scanCode({
    onlyFromCamera: false,
    scanType: ["qrCode", "wxCode"],
    success(res) {
      const userNo = extractModelUserNoFromScan(res);
      if (!userNo) {
        wx.showToast({ title: "未识别到模特二维码", icon: "none" });
        return;
      }
      openModelDetailByUserNo(userNo);
    },
    fail(err) {
      const msg = String(err?.errMsg || "");
      if (msg.includes("cancel")) return;
      wx.showToast({ title: "扫码失败", icon: "none" });
    }
  });
}

module.exports = {
  MODEL_DETAIL_PAGE,
  MODEL_SCENE_PREFIX,
  extractModelPromoUserNoFromEntry,
  extractModelUserNoFromEntry,
  extractModelUserNoFromScan,
  openModelDetailByUserNo,
  scanAndOpenModelDetail
};
