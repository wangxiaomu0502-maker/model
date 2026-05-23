Page({
  data: {
    heroPaddingTop: 64,
    modelList: [],
    loading: false,
    loadError: ""
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({
      heroPaddingTop: statusBarHeight + 30
    });
    this.loadModelList();
  },

  formatPriceText(value) {
    if (value == null || value === "") return "-";
    return `¥${value}`;
  },

  fmtMeasure(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const r = Math.round(x * 100) / 100;
    return Number.isInteger(r) ? String(Math.trunc(r)) : String(r);
  },

  resolveMediaUrl(stored, apiBase) {
    if (!stored || !String(stored).trim()) return "";
    const s = String(stored).trim();
    if (/^https?:\/\//i.test(s)) return s;
    const b = String(apiBase || "").replace(/\/$/, "");
    const p = s.startsWith("/") ? s : `/${s}`;
    return `${b}${p}`;
  },

  buildCardMeasureChips(card) {
    const m = (card && card.measurements) || {};
    const chips = [];
    const h = this.fmtMeasure(m.height);
    const wgt = this.fmtMeasure(m.weight);
    const b = this.fmtMeasure(m.bust);
    const waist = this.fmtMeasure(m.waist);
    const hip = this.fmtMeasure(m.hip);
    const shoulder = this.fmtMeasure(m.shoulder);
    const armSpan = this.fmtMeasure(m.armSpan);
    const leg = this.fmtMeasure(m.legLength);
    const shoeRaw = m.shoeSize;
    const shoeNum = this.fmtMeasure(shoeRaw);
    if (h !== "—") chips.push({ key: "h", text: `身高 ${h}cm` });
    if (wgt !== "—") chips.push({ key: "w", text: `体重 ${wgt}kg` });
    const trio = [];
    if (b !== "—") trio.push(b);
    if (waist !== "—") trio.push(waist);
    if (hip !== "—") trio.push(hip);
    if (trio.length) chips.push({ key: "bwh", text: `三围 ${trio.join("/")}` });
    if (shoulder !== "—") chips.push({ key: "sh", text: `肩宽 ${shoulder}` });
    if (armSpan !== "—") chips.push({ key: "arm", text: `臂展 ${armSpan}` });
    if (leg !== "—") chips.push({ key: "leg", text: `腿长 ${leg}` });
    if (shoeNum !== "—") chips.push({ key: "shoe", text: `鞋码 ${shoeNum}` });
    else if (shoeRaw != null && String(shoeRaw).trim()) {
      chips.push({ key: "shoe", text: `鞋码 ${String(shoeRaw).trim()}` });
    }
    return chips;
  },

  normalizeModelList(list) {
    const app = getApp();
    const apiBase = app.globalData.apiBaseUrl || "";
    const pending = app.COS_AVATAR_PLACEHOLDER;
    const arr = Array.isArray(list) ? list : [];
    return arr.map((item) => {
      const nickname = item && item.nickname ? String(item.nickname) : "";
      const avatarText = nickname ? nickname.slice(0, 1) : "模";
      const rawAvatar =
        item && item.avatarUrl != null && String(item.avatarUrl).trim()
          ? String(item.avatarUrl).trim()
          : "";
      const showAvatarImg = Boolean(rawAvatar && rawAvatar !== pending);
      const avatarDisplayUrl = app.resolveAvatarUrl(rawAvatar || null, apiBase);
      const card = item && item.card ? item.card : {};
      const angles = Array.isArray(card.photoAngles) ? card.photoAngles : [];
      const cardThumbUrls = angles
        .map((a) => this.resolveMediaUrl(a && a.url, apiBase))
        .filter(Boolean);
      const cardMeasureChips = this.buildCardMeasureChips(card);
      const hasCardSection = cardThumbUrls.length > 0 || cardMeasureChips.length > 0;
      return {
        ...item,
        avatarText,
        showAvatarImg,
        avatarDisplayUrl,
        hourlyText: this.formatPriceText(item?.price?.hourly),
        halfDayText: this.formatPriceText(item?.price?.halfDay),
        fullDayText: this.formatPriceText(item?.price?.fullDay),
        cardThumbUrls,
        cardMeasureChips,
        hasCardSection
      };
    });
  },

  loadModelList() {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({
            modelList: [],
            loadError: body.message || "模特列表加载失败"
          });
          return;
        }
        this.setData({
          modelList: this.normalizeModelList(body.list),
          loadError: ""
        });
      },
      fail: () => {
        this.setData({
          modelList: [],
          loadError: "网络异常，模特列表加载失败"
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goRegister() {
    wx.navigateTo({
      url: "/pages/intro/intro"
    });
  },

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  },

  onShareAppMessage() {
    return {
      title: "星链模库｜模特接单、商家找人一站式平台",
      path: "/pages/loading/loading",
      imageUrl: "/assets/logo/logo.png"
    };
  }
});
