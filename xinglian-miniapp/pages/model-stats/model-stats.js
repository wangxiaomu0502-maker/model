const { updateTabBar } = require("../../utils/tab-bar.js");

Page({
  data: {
    viewRole: "",
    periodTab: "today",
    currentStats: { orderCount: 0, incomeYuan: "0.00", pendingYuan: "0.00" },
    dashboardLoading: false,
    dashboardError: "",
    trend7dDisplay: [],
    brokerPeriodTab: "today",
    brokerLockedMerchantCount: 0,
    brokerReferredModelCount: 0,
    brokerIncomeStats: {
      merchantYuan: "0.00",
      modelYuan: "0.00",
      totalYuan: "0.00",
      pendingYuan: "0.00"
    },
    brokerDashLoading: false,
    brokerDashError: "",
    brokerTrend7dDisplay: []
  },

  onShow() {
    updateTabBar();
    const app = getApp();
    const role = Number(app.globalData.role || wx.getStorageSync("selectedRole") || 0);
    if (role === 1) {
      this.setData({ viewRole: "model" });
      wx.setNavigationBarTitle({ title: "统计信息" });
      this.loadModelDashboard();
      return;
    }
    if (role === 3 || role === 4) {
      this.setData({ viewRole: "broker" });
      wx.setNavigationBarTitle({ title: "统计信息" });
      this.loadBrokerDashboard();
      return;
    }
    wx.switchTab({ url: "/pages/model-list/model-list" });
  },

  formatMoneyYuan(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  },

  normalizeTrend(trend7d) {
    const arr = Array.isArray(trend7d) ? trend7d : [];
    const nums = arr.map((x) => Number(x.income) || 0);
    const maxIncome = nums.length === 0 ? 0 : Math.max(...nums);
    const denom = maxIncome > 0 ? maxIncome : 1;
    return arr.map((item) => {
      const income = Number(item.income) || 0;
      const rawPct = Math.round((income / denom) * 100);
      const barPct = income <= 0 ? 6 : Math.max(12, rawPct);
      const dk = String(item.date || "");
      return {
        date: dk,
        label: dk.length >= 10 ? dk.slice(5, 10) : dk,
        incomeText: this.formatMoneyYuan(income),
        barPct
      };
    });
  },

  pickPeriodStats(dashboard, tab) {
    const src = tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    return {
      orderCount: Number(src?.orderCount ?? 0),
      incomeYuan: this.formatMoneyYuan(src?.income),
      pendingYuan: this.formatMoneyYuan(src?.pendingSettlement)
    };
  },

  pickBrokerPeriodIncome(dashboard, tab) {
    const src = tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    return {
      merchantYuan: this.formatMoneyYuan(src?.brokerIncomeYuan ?? src?.merchantReferrerYuan),
      modelYuan: this.formatMoneyYuan(src?.totalYuan),
      totalYuan: this.formatMoneyYuan(src?.totalYuan),
      pendingYuan: this.formatMoneyYuan(src?.pendingSettlementYuan)
    };
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

  async loadModelDashboard() {
    const app = getApp();
    if (!app.globalData.token) {
      this.setData({ dashboardError: "请先登录后查看", trend7dDisplay: [], dashboardLoading: false });
      return;
    }
    this.setData({ dashboardLoading: true, dashboardError: "" });
    try {
      const data = await this.requestWithAuth("/api/models/dashboard-stats", "GET");
      if (!data?.ok) throw new Error(data?.message || "加载失败");
      const dashboard = { today: data.today, week: data.week, month: data.month };
      const currentStats = this.pickPeriodStats(dashboard, this.data.periodTab);
      this.setData({
        dashboardLoading: false,
        dashboardError: "",
        _dashboard: dashboard,
        currentStats,
        trend7dDisplay: this.normalizeTrend(data.trend7d)
      });
    } catch (_err) {
      this.setData({ dashboardLoading: false, dashboardError: "统计数据加载失败", trend7dDisplay: [] });
    }
  },

  async loadBrokerDashboard() {
    const app = getApp();
    if (!app.globalData.token) {
      this.setData({ brokerDashError: "请先登录后查看", brokerTrend7dDisplay: [], brokerDashLoading: false });
      return;
    }
    this.setData({ brokerDashLoading: true, brokerDashError: "" });
    try {
      const data = await this.requestWithAuth("/api/broker/dashboard", "GET");
      if (!data?.ok) throw new Error(data?.message || "加载失败");
      const dashboard = { today: data.today, week: data.week, month: data.month };
      const brokerIncomeStats = this.pickBrokerPeriodIncome(dashboard, this.data.brokerPeriodTab);
      this.setData({
        brokerDashLoading: false,
        brokerDashError: "",
        _brokerDash: dashboard,
        brokerLockedMerchantCount: Number(data.lockedMerchantCount ?? 0),
        brokerReferredModelCount: Number(data.referredModelCount ?? 0),
        brokerIncomeStats,
        brokerTrend7dDisplay: this.normalizeTrend(data.trend7d)
      });
    } catch (_err) {
      this.setData({ brokerDashLoading: false, brokerDashError: "统计数据加载失败", brokerTrend7dDisplay: [] });
    }
  },

  onPeriodTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.periodTab) return;
    const dash = this.data._dashboard;
    if (!dash) {
      this.setData({ periodTab: tab });
      return;
    }
    this.setData({ periodTab: tab, currentStats: this.pickPeriodStats(dash, tab) });
  },

  onBrokerPeriodTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.brokerPeriodTab) return;
    const dash = this.data._brokerDash;
    if (!dash) {
      this.setData({ brokerPeriodTab: tab });
      return;
    }
    this.setData({ brokerPeriodTab: tab, brokerIncomeStats: this.pickBrokerPeriodIncome(dash, tab) });
  }
});
