const { updateTabBar } = require("../../utils/tab-bar.js");
const { homeTabUrlForRole } = require("../../utils/role-tab.js");
const { formatMoneyYuan, normalizeTrend, requestWithAuth } = require("../../utils/dashboard-display.js");

Page({
  data: {
    periodTab: "today",
    currentStats: { orderCount: 0, incomeYuan: "0.00", pendingYuan: "0.00" },
    dashboardLoading: false,
    dashboardError: "",
    trend7dDisplay: []
  },

  onShow() {
    updateTabBar();
    const app = getApp();
    const role = Number(app.globalData.role || wx.getStorageSync("selectedRole") || 0);
    if (role !== 1) {
      const url = homeTabUrlForRole(role);
      if (url) wx.switchTab({ url });
      return;
    }
    wx.setNavigationBarTitle({ title: "统计信息" });
    this.loadModelDashboard();
  },

  pickPeriodStats(dashboard, tab) {
    const src = tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    return {
      orderCount: Number(src?.orderCount ?? 0),
      incomeYuan: formatMoneyYuan(src?.income),
      pendingYuan: formatMoneyYuan(src?.pendingSettlement)
    };
  },

  async loadModelDashboard() {
    const app = getApp();
    if (!app.globalData.token) {
      this.setData({ dashboardError: "请先登录后查看", trend7dDisplay: [], dashboardLoading: false });
      return;
    }
    this.setData({ dashboardLoading: true, dashboardError: "" });
    try {
      const data = await requestWithAuth("/api/models/dashboard-stats", "GET");
      if (!data?.ok) throw new Error(data?.message || "加载失败");
      const dashboard = { today: data.today, week: data.week, month: data.month };
      const currentStats = this.pickPeriodStats(dashboard, this.data.periodTab);
      this.setData({
        dashboardLoading: false,
        dashboardError: "",
        _dashboard: dashboard,
        currentStats,
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
    this.setData({ periodTab: tab, currentStats: this.pickPeriodStats(dash, tab) });
  }
});
