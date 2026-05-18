Page({
  data: {
    pricing: {
      hourly: "",
      halfDay: "",
      fullDay: ""
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
      if (!data?.ok || !data.pricing) return;
      const toIntString = (value) => {
        if (value === null || value === undefined || value === "") return "";
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return "";
        return String(Math.trunc(n));
      };
      this.setData({
        pricing: {
          hourly: toIntString(data.pricing.hourly),
          halfDay: toIntString(data.pricing.halfDay),
          fullDay: toIntString(data.pricing.fullDay)
        }
      });
    } catch (_error) {}
  },

  onPricingInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({
      [`pricing.${field}`]: e.detail.value
    });
  },

  async savePricing() {
    const p = this.data.pricing || {};
    const fields = ["hourly", "halfDay", "fullDay"];
    for (const field of fields) {
      const raw = String(p[field] ?? "").trim();
      if (!raw) continue;
      if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        wx.showToast({ title: "价格需为大于0的整数", icon: "none" });
        return;
      }
    }
    try {
      const data = await this.requestWithAuth("/api/models/pricing", "PUT", p);
      if (!data?.ok) {
        wx.showToast({ title: data?.message || "保存失败", icon: "none" });
        return;
      }
      wx.showToast({ title: "价格已保存", icon: "success" });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 700);
    } catch (_error) {
      wx.showToast({ title: "网络异常", icon: "none" });
    }
  }
});

