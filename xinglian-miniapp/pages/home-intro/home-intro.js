const { buildLoadingShareAppMessage } = require("../../utils/loading-share.js");
const homePageBehavior = require("../../behaviors/home-page.js");
const { bindHomePageScroll } = require("../../utils/home-page-scroll.js");

Page({
  behaviors: [homePageBehavior],

  data: {
    showRegisterBar: true
  },

  onLoad() {
    this.initHomeLayoutMetrics();
  },

  onShow() {
    this.refreshRegisterBar();
    this.loadHomeData();
    wx.nextTick(() => this.refreshHomeScrollShield());
  },

  onPageScroll(e) {
    bindHomePageScroll(this, e);
  },

  refreshRegisterBar() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    const showRegisterBar = !app.globalData.token || role === 0;
    this.setData({ showRegisterBar });
  },

  goRegister() {
    wx.navigateTo({ url: "/pages/intro/intro" });
  },

  onShareAppMessage() {
    return buildLoadingShareAppMessage();
  }
});
