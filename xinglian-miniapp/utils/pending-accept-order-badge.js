function hideMineTabRedDot() {
  [0, 1, 2].forEach((index) => {
    try {
      wx.hideTabBarRedDot({ index });
    } catch (_e) {}
  });
}

function mineTabIndexForRole(role) {
  void role;
  return 2;
}

/**
 * 同步「待模特确认接单」订单数（order_status=1）相关 UI：
 * - 底部 Tab「我的」红点（模特 / 商家均有待对方接单类订单时提示）
 * - 可选 onMineMenuBadgeCount：更新「我的」页「我的订单」金刚区角标用数字（仅模特/商家会收到 >0）
 */
function syncPendingAcceptOrderBadge(opts) {
  const apiBaseUrl = opts.apiBaseUrl || "";
  const token = opts.token || "";
  const role = Number(opts.role || 0);
  const onMineMenuBadgeCount =
    typeof opts.onMineMenuBadgeCount === "function" ? opts.onMineMenuBadgeCount : null;

  if (!token || (role !== 1 && role !== 2)) {
    hideMineTabRedDot();
    if (onMineMenuBadgeCount) onMineMenuBadgeCount(0, role);
    return;
  }

  wx.request({
    url: `${apiBaseUrl}/api/orders/my?status=1&page=1&pageSize=1`,
    method: "GET",
    header: { Authorization: `Bearer ${token}` },
    success(res) {
      const d = res.data || {};
      const ok = res.statusCode === 200 && d.ok;
      const n = ok ? Number(d.total) || 0 : 0;
      if (n > 0) {
        try {
          wx.showTabBarRedDot({ index: mineTabIndexForRole(role) });
        } catch (_e) {}
      } else {
        hideMineTabRedDot();
      }
      if (onMineMenuBadgeCount) onMineMenuBadgeCount(n, role);
    },
    fail() {
      hideMineTabRedDot();
      if (onMineMenuBadgeCount) onMineMenuBadgeCount(0, role);
    }
  });
}

module.exports = {
  syncPendingAcceptOrderBadge,
  hideMineTabRedDot
};
