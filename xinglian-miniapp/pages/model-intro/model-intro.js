const { normalizeModelList } = require("../../utils/model-list-display.js");

Page({
  data: {
    heroPaddingTop: 64,
    modelList: [],
    modelListMode: "large",
    loading: false,
    loadError: ""
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({
      heroPaddingTop: statusBarHeight + 30
    });
    this.loadModelList();
  },

  onModelListModeChange(e) {
    const mode = e.currentTarget.dataset.mode || "";
    if (mode !== "list" && mode !== "large") return;
    this.setData({ modelListMode: mode });
  },

  loadModelList() {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({
            modelList: [],
            loadError: body.message || "模特列表加载失败"
          });
          return;
        }
        this.setData({
          modelList: normalizeModelList(body.list),
          loadError: ""
        });
      },
      fail: () => {
        this.setData({
          modelList: [],
          loadError: "网络异常，模特列表加载失败"
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goRegister() {
    wx.navigateTo({
      url: "/pages/intro/intro"
    });
  },

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  },

  onShareAppMessage() {
    return {
      title: "星链模库｜模特接单、商家找人一站式平台",
      path: "/pages/loading/loading",
      imageUrl: "/assets/logo/logo.png"
    };
  }
});
