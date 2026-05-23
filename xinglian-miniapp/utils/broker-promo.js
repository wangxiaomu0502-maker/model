/** 经纪人推广：链接参数名（打开小程序时携带） */
const BROKER_QUERY_KEY = "brokerUserNo";

const STORAGE_PENDING_BROKER = "xinglian_pending_broker_user_no";

/** 小程序启动页路径（不含前导 /） */
function buildBrokerPromoPagePath(userNo) {
  const no = String(userNo || "").trim();
  if (!no) return "pages/loading/loading";
  return `pages/loading/loading?${BROKER_QUERY_KEY}=${encodeURIComponent(no)}`;
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
  savePendingBrokerUserNo,
  readPendingBrokerUserNo,
  clearPendingBrokerUserNo
};
