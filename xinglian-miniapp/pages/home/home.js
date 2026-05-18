Page({
  data: {
    role: 0,
    modelList: [],
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

  formatPriceText(value) {
    if (value == null || value === "") return "-";
    return `¥${value}`;
  },

  formatMoneyYuan(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
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

  /** 模卡尺寸：列表页用短标签展示，避免一行挤满 */
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

  pickPeriodStats(dashboard, tab) {
    const src =
      tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    return {
      orderCount: Number(src?.orderCount ?? 0),
      incomeYuan: this.formatMoneyYuan(src?.income),
      pendingYuan: this.formatMoneyYuan(src?.pendingSettlement)
    };
  },

  pickBrokerPeriodIncome(dashboard, tab) {
    const src =
      tab === "week" ? dashboard.week : tab === "month" ? dashboard.month : dashboard.today;
    return {
      merchantYuan: this.formatMoneyYuan(src?.brokerIncomeYuan ?? src?.merchantReferrerYuan),
      modelYuan: this.formatMoneyYuan(src?.totalYuan),
      totalYuan: this.formatMoneyYuan(src?.totalYuan),
      pendingYuan: this.formatMoneyYuan(src?.pendingSettlementYuan)
    };
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
        income,
        incomeText: this.formatMoneyYuan(income),
        barPct
      };
    });
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
      this.setData({
        dashboardError: "请先登录后查看",
        trend7dDisplay: [],
        dashboardLoading: false
      });
      return;
    }

    this.setData({ dashboardLoading: true, dashboardError: "" });
    try {
      const data = await this.requestWithAuth("/api/models/dashboard-stats", "GET");
      if (!data?.ok) {
        throw new Error(data?.message || "加载失败");
      }
      const dashboard = {
        today: data.today,
        week: data.week,
        month: data.month
      };
      const tab = this.data.periodTab;
      const currentStats = this.pickPeriodStats(dashboard, tab);
      const trend7dDisplay = this.normalizeTrend(data.trend7d);
      this.setData({
        dashboardLoading: false,
        dashboardError: "",
        _dashboard: dashboard,
        currentStats,
        trend7dDisplay
      });
    } catch (_err) {
      this.setData({
        dashboardLoading: false,
        dashboardError: "统计数据加载失败",
        trend7dDisplay: []
      });
    }
  },

  async loadBrokerDashboard() {
    const app = getApp();
    if (!app.globalData.token) {
      this.setData({
        brokerDashError: "请先登录后查看",
        brokerTrend7dDisplay: [],
        brokerDashLoading: false
      });
      return;
    }

    this.setData({ brokerDashLoading: true, brokerDashError: "" });
    try {
      const data = await this.requestWithAuth("/api/broker/dashboard", "GET");
      if (!data?.ok) {
        throw new Error(data?.message || "加载失败");
      }
      const dashboard = {
        today: data.today,
        week: data.week,
        month: data.month
      };
      const tab = this.data.brokerPeriodTab;
      const brokerIncomeStats = this.pickBrokerPeriodIncome(dashboard, tab);
      const brokerTrend7dDisplay = this.normalizeTrend(data.trend7d);
      this.setData({
        brokerDashLoading: false,
        brokerDashError: "",
        _brokerDash: dashboard,
        brokerLockedMerchantCount: Number(data.lockedMerchantCount ?? 0),
        brokerReferredModelCount: Number(data.referredModelCount ?? 0),
        brokerIncomeStats,
        brokerTrend7dDisplay
      });
    } catch (_err) {
      this.setData({
        brokerDashLoading: false,
        brokerDashError: "统计数据加载失败",
        brokerTrend7dDisplay: []
      });
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
    const currentStats = this.pickPeriodStats(dash, tab);
    this.setData({ periodTab: tab, currentStats });
  },

  onBrokerPeriodTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.brokerPeriodTab) return;
    const dash = this.data._brokerDash;
    if (!dash) {
      this.setData({ brokerPeriodTab: tab });
      return;
    }
    const brokerIncomeStats = this.pickBrokerPeriodIncome(dash, tab);
    this.setData({ brokerPeriodTab: tab, brokerIncomeStats });
  },

  async onShow() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    this.setData({ role });

    const { syncPendingAcceptOrderBadge, hideMineTabRedDot } = require("../../utils/pending-accept-order-badge.js");
    if (role === 1 || role === 2) {
      syncPendingAcceptOrderBadge({
        apiBaseUrl: app.globalData.apiBaseUrl,
        token: app.globalData.token || "",
        role
      });
    } else {
      hideMineTabRedDot();
    }

    if (role === 1) {
      await this.loadModelDashboard();
      return;
    }

    if (role === 3 || role === 4) {
      await this.loadBrokerDashboard();
      return;
    }

    if (role !== 2) return;
    try {
      const data = await this.requestWithAuth("/api/models/list", "GET");
      if (!data?.ok) return;
      this.setData({ modelList: this.normalizeModelList(data.list) });
    } catch (_error) {}
  },

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  }
});
