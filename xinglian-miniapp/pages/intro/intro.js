const {
  buildLoadingShareAppMessage,
  buildLoadingShareTimeline
} = require("../../utils/loading-share.js");

Page({
  data: {
    navPaddingTop: 24
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({
      navPaddingTop: statusBarHeight + 8
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({
      url: "/pages/model-list/model-list"
    });
  },

  goIdentity() {
    wx.navigateTo({
      url: "/pages/identity/identity"
    });
  },

  onShareAppMessage() {
    return buildLoadingShareAppMessage();
  },

  onShareTimeline() {
    return buildLoadingShareTimeline();
  }
});
