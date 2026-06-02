/** 上次看完启动介绍屏的时间戳（ms） */
const STORAGE_KEY = "xinglian_launch_intro_seen_at";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const TAB_PAGE_PATHS = [
  "pages/home/home",
  "pages/model-list/model-list",
  "pages/model-stats/model-stats",
  "pages/broker-stats/broker-stats",
  "pages/mine/mine"
];

function getLastSeenAt() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_e) {
    return 0;
  }
}

/** 距上次展示已满 7 天，或从未展示过 */
function shouldShowLaunchIntro() {
  const last = getLastSeenAt();
  if (!last) return true;
  return Date.now() - last >= WEEK_MS;
}

function markLaunchIntroSeen() {
  try {
    wx.setStorageSync(STORAGE_KEY, Date.now());
  } catch (_e) {}
}

function normalizeTargetUrl(targetUrl) {
  const url = String(targetUrl || "").trim();
  return url || "/pages/home-intro/home-intro";
}

function isTabPageUrl(url) {
  const path = normalizeTargetUrl(url).replace(/^\//, "").split("?")[0];
  return TAB_PAGE_PATHS.includes(path);
}

function navigateAfterLaunchIntro(targetUrl) {
  const url = normalizeTargetUrl(targetUrl);
  if (isTabPageUrl(url)) {
    wx.switchTab({ url: url.split("?")[0] });
    return;
  }
  wx.reLaunch({ url });
}

module.exports = {
  STORAGE_KEY,
  WEEK_MS,
  getLastSeenAt,
  shouldShowLaunchIntro,
  markLaunchIntroSeen,
  navigateAfterLaunchIntro,
  normalizeTargetUrl
};
