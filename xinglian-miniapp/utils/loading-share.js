const { BROKER_QUERY_KEY, buildBrokerPromoPagePath } = require("./broker-promo.js");

const DEFAULT_SHARE_TITLE = "星链相连，模库机遇无限";
const DEFAULT_TIMELINE_TITLE = "星链相连，模库机遇无限";
const DEFAULT_SHARE_IMAGE = "/assets/logo/logo.png";

function getCurrentBrokerUserNo(fallbackUserNo) {
  const fallback = String(fallbackUserNo || "").trim();
  if (fallback) return fallback;

  try {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    if (role !== 3 && role !== 4) return "";
    return String(app.globalData.userNo || "").trim();
  } catch (_e) {
    return "";
  }
}

function buildLoadingSharePath(options = {}) {
  return buildBrokerPromoPagePath(getCurrentBrokerUserNo(options.brokerUserNo));
}

function buildLoadingShareQuery(options = {}) {
  const brokerUserNo = getCurrentBrokerUserNo(options.brokerUserNo);
  if (!brokerUserNo) return "";
  return `${BROKER_QUERY_KEY}=${encodeURIComponent(brokerUserNo)}`;
}

function buildLoadingShareAppMessage(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE_TITLE,
    path: buildLoadingSharePath(options),
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE
  };
}

function buildLoadingShareTimeline(options = {}) {
  return {
    title: options.title || DEFAULT_TIMELINE_TITLE,
    query: buildLoadingShareQuery(options),
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE
  };
}

function installGlobalLoadingShare() {
  if (typeof Page !== "function" || Page.__xinglianLoadingShareInstalled) return;

  const originalPage = Page;
  Page = function xinglianPage(pageOptions = {}) {
    const options = pageOptions || {};
    if (typeof options.onShareAppMessage !== "function") {
      options.onShareAppMessage = function onShareAppMessage() {
        return buildLoadingShareAppMessage();
      };
    }
    if (typeof options.onShareTimeline !== "function") {
      options.onShareTimeline = function onShareTimeline() {
        return buildLoadingShareTimeline();
      };
    }
    return originalPage(options);
  };
  Page.__xinglianLoadingShareInstalled = true;
}

module.exports = {
  buildLoadingSharePath,
  buildLoadingShareQuery,
  buildLoadingShareAppMessage,
  buildLoadingShareTimeline,
  installGlobalLoadingShare
};
