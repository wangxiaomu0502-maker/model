function calcHomeScrollShieldThreshold(systemInfo) {
  const statusBarHeight = systemInfo.statusBarHeight || 20;
  let navBarHeight = statusBarHeight + 44;

  try {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    navBarHeight = menuButton.top + menuButton.height;
  } catch (error) {
    // 开发者工具或未就绪时沿用默认值
  }

  return Math.max(8, navBarHeight - statusBarHeight + 12);
}

function syncHomeScrollShield(page, scrollTop) {
  if (!page || typeof page.setData !== "function") return;
  const threshold = Number(page.data.homeScrollShieldThreshold) || 12;
  const homeScrolled = (Number(scrollTop) || 0) > threshold;
  if (homeScrolled !== page.data.homeScrolled) {
    page.setData({ homeScrolled });
  }
}

function bindHomePageScroll(page, e) {
  syncHomeScrollShield(page, e && e.scrollTop);
}

function refreshHomeScrollShield(page) {
  if (!page) return;
  wx.createSelectorQuery()
    .selectViewport()
    .scrollOffset((res) => {
      syncHomeScrollShield(page, res && res.scrollTop);
    })
    .exec();
}

module.exports = {
  calcHomeScrollShieldThreshold,
  bindHomePageScroll,
  refreshHomeScrollShield
};
