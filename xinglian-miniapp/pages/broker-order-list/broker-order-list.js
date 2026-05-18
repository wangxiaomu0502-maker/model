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
    tabs: [
      { key: "", label: "全部" },
      { key: "1", label: "待接单" },
      { key: "2", label: "进行中" },
      { key: "3", label: "待商家确认" },
      { key: "4", label: "已完成" },
      { key: "9", label: "已取消" }
    ]
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
    this.setData({ page: 1, list: [] }, () => this.fetchPage(true));
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key ?? "";
    if (key === this.data.statusFilter) return;
    this.setData({ statusFilter: key, page: 1, list: [] }, () => this.fetchPage(true));
  },

  onReachBottom() {
    const { list, total, loading, loadingMore } = this.data;
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
    const url = `${app.globalData.apiBaseUrl}/api/broker/orders?${qs.join("&")}`;
    if (reset) this.setData({ loading: true });
    else this.setData({ loadingMore: true });
    wx.request({
      url,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const d = res.data || {};
        if (res.statusCode !== 200 || !d.ok) {
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
      fail: () => wx.showToast({ title: "网络异常", icon: "none" }),
      complete: () => this.setData({ loading: false, loadingMore: false })
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}&broker=1` });
  }
});
