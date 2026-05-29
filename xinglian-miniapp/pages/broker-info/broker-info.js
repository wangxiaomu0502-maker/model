Page({
  data: {
    canUse: true,
    loading: true,
    hasBroker: false,
    brokerDisplayName: "",
    brokerUserNoDisplay: "",
    hint:
      "经纪人绑定由平台在后台完成，用于转介绍关系与佣金归属。分配完成后将自动展示在本页；如需调整请联系平台客服。"
  },

  ensureMerchant() {
    const app = getApp();
    const r = Number(app.globalData.role || 0);
    if (r === 2) {
      this.setData({ canUse: true });
      return true;
    }
    this.setData({ canUse: false, loading: false });
    wx.showToast({ title: "仅客户可查看", icon: "none" });
    setTimeout(() => {
      wx.navigateBack();
    }, 1600);
    return false;
  },

  onShow() {
    if (!this.ensureMerchant()) return;
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
          brokerUserNoDisplay: has ? String(rb.userNo) : ""
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({ loading: false });
      }
    });
  }
});
