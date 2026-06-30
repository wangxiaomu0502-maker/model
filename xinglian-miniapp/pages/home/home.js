const { updateTabBar } = require("../../utils/tab-bar.js");
const homePageBehavior = require("../../behaviors/home-page.js");
const { bindHomePageScroll } = require("../../utils/home-page-scroll.js");

Page({
  behaviors: [homePageBehavior],

  onLoad() {
    this.initHomeLayoutMetrics();
  },

  onShow() {
    updateTabBar();
    this.loadHomeData();
    wx.nextTick(() => this.refreshHomeScrollShield());
  },

  onPageScroll(e) {
    bindHomePageScroll(this, e);
  }
});
