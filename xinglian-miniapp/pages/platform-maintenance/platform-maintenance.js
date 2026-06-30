const { requestPlatformMaintenanceStatus, DEFAULT_MESSAGE } = require("../../utils/platform-maintenance.js");

Page({
  data: {
    message: DEFAULT_MESSAGE,
    checking: false
  },

  onLoad(options) {
    const message = decodeURIComponent(String(options.message || "").trim());
    if (message) {
      this.setData({ message });
    }
  },

  async onRetryTap() {
    if (this.data.checking) return;
    this.setData({ checking: true });
    try {
      const app = getApp();
      const status = await requestPlatformMaintenanceStatus(app.globalData.apiBaseUrl);
      if (status.maintenanceEnabled) {
        this.setData({
          message: status.maintenanceMessage,
          checking: false
        });
        wx.showToast({ title: "仍在维护中", icon: "none" });
        return;
      }
      wx.reLaunch({ url: "/pages/loading/loading" });
    } catch (error) {
      this.setData({ checking: false });
      wx.showToast({
        title: error.message || "网络异常，请稍后重试",
        icon: "none"
      });
    }
  }
});
