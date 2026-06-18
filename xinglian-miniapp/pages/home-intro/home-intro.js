const { goModelListByHomeCategory, requireLogin } = require("../../utils/home-model-categories.js");
const { normalizeModelList, pickFeaturedModels } = require("../../utils/model-list-display.js");
const { buildLoadingShareAppMessage } = require("../../utils/loading-share.js");

const QUICK_ENTRIES = [
  { key: "model", label: "模特", icon: "模", themeClass: "home-quick-item--model" },
  { key: "actor", label: "演员", icon: "演", themeClass: "home-quick-item--actor" },
  { key: "broker", label: "经纪人", icon: "经", themeClass: "home-quick-item--broker" },
  { key: "merchant", label: "商家", icon: "商", themeClass: "home-quick-item--merchant" },
  { key: "shoot", label: "商拍中心", icon: "拍", themeClass: "home-quick-item--shoot" },
  { key: "training", label: "培训中心", icon: "培", themeClass: "home-quick-item--training" },
  { key: "star", label: "明星模特", icon: "星", themeClass: "home-quick-item--star" },
  { key: "orders", label: "商单展示", icon: "单", themeClass: "home-quick-item--orders" }
];

Page({
  data: {
    modelCount: "--",
    brokerCount: "--",
    merchantCount: "--",
    quickEntries: QUICK_ENTRIES,
    featuredModels: [],
    loading: false,
    loadError: "",
    showRegisterBar: true
  },

  onShow() {
    this.refreshRegisterBar();
    this.loadHomeData();
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

  loadHomeData() {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    this.loadSummary(app);
    this.loadFeaturedModels(app);
  },

  loadSummary(app) {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/home-summary`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) return;
        this.setData({
          modelCount: Number(body.modelCount || 0),
          brokerCount: Number(body.brokerCount || 0),
          merchantCount: Number(body.merchantCount || 0)
        });
      }
    });
  },

  loadFeaturedModels(app) {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list?limit=10`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({ featuredModels: [], loadError: body.message || "首页内容加载失败" });
          return;
        }
        const featuredModels = pickFeaturedModels(normalizeModelList(body.list), 10);
        const patch = { featuredModels, loadError: "" };
        if (this.data.modelCount === "--") {
          patch.modelCount = featuredModels.length;
        }
        this.setData(patch);
      },
      fail: () => {
        this.setData({ featuredModels: [], loadError: "网络异常，首页内容加载失败" });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goModelList() {
    wx.switchTab({ url: "/pages/model-list/model-list" });
  },

  goSearchPage() {
    wx.navigateTo({ url: "/pages/home-search/home-search" });
  },

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  },

  goBrokerIntro() {
    wx.navigateTo({ url: "/pages/broker-intro/broker-intro" });
  },

  goMerchantIntro() {
    wx.navigateTo({ url: "/pages/merchant-intro/merchant-intro" });
  },

  onQuickEntryTap(e) {
    const key = e.currentTarget.dataset.key || "";
    const app = getApp();
    if (!requireLogin(app)) return;

    switch (key) {
      case "model":
        wx.switchTab({ url: "/pages/model-list/model-list" });
        break;
      case "actor":
        goModelListByHomeCategory("actor");
        break;
      case "broker":
        wx.navigateTo({ url: "/pages/broker-intro/broker-intro" });
        break;
      case "merchant":
        wx.navigateTo({ url: "/pages/merchant-intro/merchant-intro" });
        break;
      case "shoot":
        wx.navigateTo({ url: "/pages/commercial-shoot-center/commercial-shoot-center" });
        break;
      case "training":
        wx.navigateTo({ url: "/pages/model-training/model-training" });
        break;
      case "star":
        app.globalData.pendingModelListFilter = {
          levelIndex: 1,
          categoryLabel: "明星模特",
          ts: Date.now()
        };
        wx.switchTab({ url: "/pages/model-list/model-list" });
        break;
      case "orders":
        wx.navigateTo({ url: "/pages/business-showcase/business-showcase" });
        break;
      default:
        wx.showToast({ title: "开发中，敬请期待", icon: "none" });
    }
  },

  goEntryPage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    wx.navigateTo({ url });
  },

  onShareAppMessage() {
    return buildLoadingShareAppMessage();
  }
});
