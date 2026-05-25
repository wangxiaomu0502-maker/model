const { updateTabBar } = require("../../utils/tab-bar.js");

/** 兼容旧路径：统一进入 model-stats */
Page({
  onShow() {
    updateTabBar();
    wx.switchTab({ url: "/pages/model-stats/model-stats" });
  }
});
