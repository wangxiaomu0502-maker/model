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
      url: "/pages/home/home"
    });
  },

  goIdentity() {
    wx.navigateTo({
      url: "/pages/identity/identity"
    });
  },

  onShareAppMessage() {
    return {
      title: "星链模库｜模特接单、商家找人一站式平台",
      path: "/pages/loading/loading",
      imageUrl: "/assets/logo/logo.png"
    };
  },

  onShareTimeline() {
    return {
      title: "星链模库：连接模特、商家、经纪人的高效协作平台",
      query: "",
      imageUrl: "/assets/logo/logo.png"
    };
  }
});
