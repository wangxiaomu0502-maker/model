const { syncPendingAcceptOrderBadge } = require("../../utils/pending-accept-order-badge.js");

const PAYMENT_STATUS_FALLBACK = {
  0: "未支付",
  1: "已支付",
  2: "退款中",
  3: "已退款"
};

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loadingMore: false,
    statusFilter: "",
    viewerRole: 0,
    /** 待模特确认接单（status=1）笔数，用于 Tab 红点 */
    pendingAcceptCount: 0,
    /** 与 xinglian-server order-status.ts orderStatusLabel 文案保持一致（key = order_status） */
    tabs: [
      { key: "", label: "全部" },
      { key: "1", label: "待模特确认接单" },
      { key: "2", label: "进行中" },
      { key: "3", label: "模特已完成" },
      { key: "4", label: "已完成" },
      { key: "9", label: "已取消" }
    ]
  },

  onShow() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    if (role !== 1 && role !== 2) {
      wx.showToast({ title: "当前身份无订单", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ viewerRole: role });
    syncPendingAcceptOrderBadge({
      apiBaseUrl: app.globalData.apiBaseUrl,
      token: app.globalData.token || "",
      role,
      onMineMenuBadgeCount: (n) => {
        this.setData({ pendingAcceptCount: n });
      }
    });
    this.setData({ page: 1, list: [] }, () => this.fetchPage(true));
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key ?? "";
    if (key === this.data.statusFilter) return;
    this.setData({ statusFilter: key, page: 1, list: [] }, () => this.fetchPage(true));
  },

  onReachBottom() {
    const { list, total, loadingMore, loading } = this.data;
    if (loading || loadingMore || list.length >= total) return;
    this.setData({ page: this.data.page + 1 }, () => this.fetchPage(false));
  },

  fetchPage(reset) {
    const app = getApp();
    const token = app.globalData.token;
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    const { page, pageSize, statusFilter, list } = this.data;
    const qs = [`page=${page}`, `pageSize=${pageSize}`];
    if (statusFilter !== "") qs.push(`status=${encodeURIComponent(statusFilter)}`);
    const url = `${app.globalData.apiBaseUrl}/api/orders/my?${qs.join("&")}`;
    if (reset) this.setData({ loading: true });
    else this.setData({ loadingMore: true });
    wx.request({
      url,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const d = res.data || {};
        if (!d.ok) {
          wx.showToast({ title: d.message || "加载失败", icon: "none" });
          return;
        }
        const raw = Array.isArray(d.list) ? d.list : [];
        const chunk = raw.map((item) => ({
          ...item,
          paymentStatusText:
            item.paymentStatusText ||
            PAYMENT_STATUS_FALLBACK[item.paymentStatus] ||
            `支付${item.paymentStatus}`
        }));
        const merged = reset ? chunk : list.concat(chunk);
        this.setData({
          list: merged,
          total: Number(d.total) || 0,
          page,
          pageSize: Number(d.pageSize) || pageSize
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
  }
});
