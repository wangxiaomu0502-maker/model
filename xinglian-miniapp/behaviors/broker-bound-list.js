/** 经纪人「我的商家」列表共用：分页、搜索、展示字段归一 */
module.exports = Behavior({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loadingMore: false,
    keyword: "",
    searchDraft: ""
  },

  methods: {
    ensureBrokerRole() {
      const app = getApp();
      const r = Number(app.globalData.role || 0);
      if (r === 3 || r === 4) return true;
      wx.showToast({ title: "仅经纪人或代理人可查看", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return false;
    },

    getListApiPath() {
      return "";
    },

    normalizeListItem(raw, app) {
      const nickname = raw.nickname || "未设置昵称";
      const avatarUrl = app.resolveAvatarUrl(raw.avatarUrl, app.globalData.apiBaseUrl);
      const audit = Number(raw.profileAuditStatus ?? 0);
      return {
        ...raw,
        nickname,
        avatarUrl,
        avatarText: nickname.slice(0, 1) || "用",
        showAvatarImg: avatarUrl && !String(avatarUrl).includes("/assets/logo/logo.png"),
        auditTone: audit === 2 ? "ok" : audit === 3 ? "bad" : audit === 1 ? "pending" : "muted",
        contractTone: raw.contractSigned ? "ok" : "warn"
      };
    },

    fetchPage(reset) {
      const apiPath = this.getListApiPath();
      if (!apiPath) return;
      const app = getApp();
      const token = app.globalData.token;
      if (!token) {
        wx.showToast({ title: "请先登录", icon: "none" });
        return;
      }
      const { page, pageSize, keyword, list } = this.data;
      const qs = [`page=${page}`, `pageSize=${pageSize}`];
      const kw = String(keyword || "").trim();
      if (kw) qs.push(`keyword=${encodeURIComponent(kw)}`);
      const url = `${app.globalData.apiBaseUrl}${apiPath}?${qs.join("&")}`;
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
          const chunk = raw.map((item) => this.normalizeListItem(item, app));
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

    onSearchInput(e) {
      this.setData({ searchDraft: (e.detail && e.detail.value) || "" });
    },

    onSearchConfirm() {
      const kw = String(this.data.searchDraft || "").trim();
      if (kw === this.data.keyword && this.data.list.length > 0) return;
      this.setData({ keyword: kw, page: 1, list: [] }, () => this.fetchPage(true));
    },

    onClearSearch() {
      this.setData({ searchDraft: "", keyword: "", page: 1, list: [] }, () => this.fetchPage(true));
    },

    onReachBottom() {
      const { list, total, loading, loadingMore } = this.data;
      if (loading || loadingMore || list.length >= total) return;
      this.setData({ page: this.data.page + 1 }, () => this.fetchPage(false));
    }
  }
});
