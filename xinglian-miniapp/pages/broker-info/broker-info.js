Page({
  data: {
    canUse: true,
    loading: true,
    saving: false,
    hasBroker: false,
    brokerDisplayName: "",
    brokerUserNoDisplay: "",
    brokerInput: "",
    hint:
      "请输入经纪人在「我的」页面展示的 12 位用户 ID（user_no）。经纪人须已在平台签署「平台与经纪人」合同后方可绑定；保存后用于转介绍关系与佣金归属；留空并保存可解除绑定。"
  },

  ensureModelOrMerchant() {
    const app = getApp();
    const r = Number(app.globalData.role || 0);
    if (r === 1 || r === 2) {
      this.setData({ canUse: true });
      return true;
    }
    this.setData({ canUse: false, loading: false });
    wx.showToast({ title: "仅模特与商家可使用", icon: "none" });
    setTimeout(() => {
      wx.navigateBack();
    }, 1600);
    return false;
  },

  onShow() {
    if (!this.ensureModelOrMerchant()) return;
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
          wx.showToast({
            title: body.message || "加载失败",
            icon: "none"
          });
          this.setData({ loading: false });
          return;
        }
        const rb = user.referrerBroker;
        const has = rb && rb.userNo;
        this.setData({
          loading: false,
          hasBroker: !!has,
          brokerDisplayName: has
            ? String(rb.displayName || rb.userNo || "经纪人")
            : "",
          brokerUserNoDisplay: has ? String(rb.userNo) : "",
          brokerInput: has ? String(rb.userNo) : ""
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },

  onBrokerInput(e) {
    this.setData({ brokerInput: e.detail.value });
  },

  onSave() {
    if (!this.data.canUse || this.data.saving) return;
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    const raw = String(this.data.brokerInput || "").trim();
    this.setData({ saving: true });
    wx.request({
      url: `${apiBaseUrl}/api/users/me/referrer`,
      method: "PUT",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: { brokerUserNo: raw },
      success: (res) => {
        const body = res.data || {};
        const user = body.user;
        if (res.statusCode !== 200 || !body.ok || !user) {
          wx.showToast({
            title: body.message || "保存失败",
            icon: "none",
            duration: 2500
          });
          return;
        }
        wx.showToast({ title: "已保存", icon: "success" });
        const rb = user.referrerBroker;
        const has = rb && rb.userNo;
        this.setData({
          hasBroker: !!has,
          brokerDisplayName: has
            ? String(rb.displayName || rb.userNo || "经纪人")
            : "",
          brokerUserNoDisplay: has ? String(rb.userNo) : "",
          brokerInput: has ? String(rb.userNo) : ""
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
      },
      complete: () => {
        this.setData({ saving: false });
      }
    });
  },

  onClear() {
    this.setData({ brokerInput: "" });
  }
});
