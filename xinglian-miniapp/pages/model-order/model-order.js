Page({
  data: {
    settings: {
      orderEnabled: false,
      onlyLocal: false,
      onlyFemale: false
    }
  },

  requestWithAuth(url, method, data) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}${url}`,
        method,
        data,
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  },

  async onLoad() {
    try {
      const data = await this.requestWithAuth("/api/models/me", "GET");
      if (data?.ok && data.orderSettings?.settings) {
        const remoteSettings = data.orderSettings.settings;
        this.setData({
          settings: {
            ...this.data.settings,
            ...remoteSettings
          }
        });
      }
    } catch (_error) {}
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const value = e.detail.value;

    this.setData({
      settings: { ...this.data.settings, [key]: value }
    });
  },

  async saveSettings() {
    const settings = this.data.settings || {};
    try {
      const data = await this.requestWithAuth("/api/models/order-settings", "PUT", { settings });
      if (!data?.ok) {
        wx.showToast({ title: data?.message || "保存失败", icon: "none" });
        return;
      }
      wx.showToast({ title: "接单设置已保存", icon: "success" });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 700);
    } catch (_error) {
      wx.showToast({ title: "网络异常", icon: "none" });
    }
  }
});

