function avatarText(nickname) {
  const text = String(nickname || "").trim();
  return text ? text.slice(0, 1) : "?";
}

function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeMerchant(raw) {
  const avatarUrl = String(raw.avatarUrl || "").trim();
  return {
    userNo: raw.userNo,
    nickname: raw.nickname || "未命名",
    avatarUrl,
    showAvatarImg: !!avatarUrl,
    avatarText: avatarText(raw.nickname),
    city: raw.city || "",
    broker: raw.broker || null,
    joinedAtText: formatDate(raw.joinedAt)
  };
}

Page({
  data: {
    merchant: null,
    loading: false,
    loadError: ""
  },

  onLoad(options) {
    const userNo = decodeURIComponent(options.userNo || "").trim();
    if (!userNo) {
      this.setData({ loadError: "缺少用户参数" });
      return;
    }
    this.loadDetail(userNo);
  },

  loadDetail(userNo) {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/search/merchant`,
      method: "GET",
      data: { userNo },
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok || !body.merchant) {
          this.setData({ merchant: null, loadError: body.message || "加载失败" });
          return;
        }
        this.setData({ merchant: normalizeMerchant(body.merchant), loadError: "" });
      },
      fail: () => {
        this.setData({ merchant: null, loadError: "网络异常，请稍后重试" });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goBrokerDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/broker-detail/broker-detail?userNo=${encodeURIComponent(userNo)}`
    });
  }
});
