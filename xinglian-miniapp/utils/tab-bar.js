/** 使用 custom tabBar 时需隐藏微信原生 tabBar，避免出现两层底部导航 */
function hideNativeTabBar() {
  try {
    wx.hideTabBar({ animation: false });
  } catch (_e) {}
}

/** 各 tab 页 onShow 时调用，同步自定义 tabBar 选中态 */
function updateTabBar(retry = 0) {
  hideNativeTabBar();
  const page = getCurrentPages().pop();
  if (!page || typeof page.getTabBar !== "function") return;
  const tabBar = page.getTabBar();
  if (tabBar && typeof tabBar.refresh === "function") {
    tabBar.refresh();
    return;
  }
  if (retry < 5) {
    setTimeout(() => updateTabBar(retry + 1), 50);
  }
}

module.exports = { updateTabBar, hideNativeTabBar };
