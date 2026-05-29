const { buildBrokerPromoPagePath } = require("../../utils/broker-promo.js");
const { buildLoadingShareAppMessage } = require("../../utils/loading-share.js");

Page({
  data: {
    loading: true,
    urlLinkLoading: false,
    userNo: "",
    nickname: "",
    urlLink: "",
    urlLinkErrorText: "",
    expireDays: 30,
    maxExpireDays: 30,
    promoPath: "",
    promoPathDisplay: ""
  },

  ensureBrokerRole() {
    const app = getApp();
    const r = Number(app.globalData.role || 0);
    if (r === 3 || r === 4) return true;
    wx.showToast({ title: "仅经纪人或代理人可查看", icon: "none" });
    setTimeout(() => wx.navigateBack(), 1200);
    return false;
  },

  onShow() {
    if (!this.ensureBrokerRole()) return;
    this.loadMe();
  },

  loadMe() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    wx.request({
      url: `${apiBaseUrl}/api/users/me`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const body = res.data || {};
        const user = body.user;
        if (res.statusCode !== 200 || !body.ok || !user) {
          wx.showToast({ title: body.message || "加载失败", icon: "none" });
          this.setData({ loading: false });
          return;
        }
        const userNo = String(user.userNo || "").trim();
        const promoPath = buildBrokerPromoPagePath(userNo);
        this.setData({
          loading: false,
          userNo,
          nickname: String(user.nickname || ""),
          promoPath,
          promoPathDisplay: promoPath
        });
        this.loadUrlLink();
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },

  loadUrlLink() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) return;
    this.setData({ urlLinkLoading: true, urlLinkErrorText: "" });
    wx.request({
      url: `${apiBaseUrl}/api/broker/promo-url-link`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          const msg = "待小程序正式上线后提供";
          this.setData({ urlLink: "", urlLinkErrorText: msg });
          wx.showToast({
            title: msg,
            icon: "none",
            duration: 2800
          });
          return;
        }
        const urlLink = String(body.urlLink || "").trim();
        this.setData({
          urlLink,
          urlLinkErrorText: "",
          expireDays: Number(body.expireDays) || 30,
          maxExpireDays: Number(body.maxExpireDays) || 30,
          promoPath: String(body.miniProgramPath || this.data.promoPath || "").trim(),
          promoPathDisplay: urlLink || this.data.promoPathDisplay
        });
      },
      fail: () => {
        const msg = "待小程序正式上线后提供";
        this.setData({ urlLink: "", urlLinkErrorText: msg });
        wx.showToast({ title: msg, icon: "none", duration: 2800 });
      },
      complete: () => {
        this.setData({ urlLinkLoading: false });
      }
    });
  },

  onRefreshUrlLink() {
    if (this.data.urlLinkLoading) return;
    this.loadUrlLink();
  },

  onCopyLink() {
    const link = String(this.data.urlLink || "").trim();
    if (!link) {
      wx.showToast({
        title: this.data.urlLinkLoading ? "链接生成中，请稍候" : "待小程序正式上线后提供",
        icon: "none",
        duration: 2800
      });
      return;
    }
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: "已复制 HTTPS 链接", icon: "success" })
    });
  },

  onCopyUserNo() {
    const no = String(this.data.userNo || "").trim();
    if (!no) {
      wx.showToast({ title: "暂无用户 ID", icon: "none" });
      return;
    }
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: "已复制用户 ID", icon: "success" })
    });
  },

  onShareAppMessage() {
    return buildLoadingShareAppMessage({
      title: "星链模库｜客户注册",
      brokerUserNo: this.data.userNo
    });
  }
});
