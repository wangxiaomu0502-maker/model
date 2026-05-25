const { updateTabBar } = require("../../utils/tab-bar.js");
const { homeTabUrlForRole } = require("../../utils/role-tab.js");
const { formatMoneyYuan, normalizeTrend, requestWithAuth } = require("../../utils/dashboard-display.js");

Page({
  data: {
    periodTab: "today",
    lockedMerchantCount: 0,
    incomeStats: {
      incomeYuan: "0.00",
      totalYuan: "0.00",
      pendingYuan: "0.00"
    },
    dashboardLoading: false,
    dashboardError: "",
    trend7dDisplay: []
  },

  onShow() {
    updateTabBar();
    const app = getApp();
    const role = Number(app.globalData.role || wx.getStorageSync("selectedRole") || 0);
    if (role !== 3 && role !== 4) {
      const url = homeTabUrlForRole(role);
      if (url) wx.switchTab({ url });
      return;
    }
    wx.setNavigationBarTitle({ title: "统计信息" });
    this.loadDashboard();
  },

  pickPeriodIncome(dashboard, tab) {
    const src = tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    const income = src?.brokerIncomeYuan ?? src?.totalYuan;
    return {
      incomeYuan: formatMoneyYuan(income),
      totalYuan: formatMoneyYuan(src?.totalYuan),
      pendingYuan: formatMoneyYuan(src?.pendingSettlementYuan)
    };
  },

  async loadDashboard() {
    const app = getApp();
    if (!app.globalData.token) {
      this.setData({ dashboardError: "请先登录后查看", trend7dDisplay: [], dashboardLoading: false });
      return;
    }
    this.setData({ dashboardLoading: true, dashboardError: "" });
    try {
      const data = await requestWithAuth("/api/broker/dashboard", "GET");
      if (!data?.ok) throw new Error(data?.message || "加载失败");
      const dashboard = { today: data.today, week: data.week, month: data.month };
      const incomeStats = this.pickPeriodIncome(dashboard, this.data.periodTab);
      this.setData({
        dashboardLoading: false,
        dashboardError: "",
        _dashboard: dashboard,
        lockedMerchantCount: Number(data.lockedMerchantCount ?? 0),
        incomeStats,
        trend7dDisplay: normalizeTrend(data.trend7d)
      });
    } catch (_err) {
      this.setData({ dashboardLoading: false, dashboardError: "统计数据加载失败", trend7dDisplay: [] });
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
    this.setData({ periodTab: tab, incomeStats: this.pickPeriodIncome(dash, tab) });
  }
});
