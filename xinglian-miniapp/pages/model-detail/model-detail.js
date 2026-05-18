const HOUR_MAX = 8;

function pad2(n) {
  return `${n}`.padStart(2, "0");
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

Page({
  data: {
    userNo: "",
    loading: true,
    loadError: "",
    model: null,
    cardUrls: [],
    portfolioSections: [],
    bookableDateOptions: [],
    selectedDateKey: "",
    durationKind: "",
    hourCount: 2,
    hourIndex: 1,
    hourLabels: Array.from({ length: HOUR_MAX }, (_, i) => `${i + 1} 小时`),
    canSubmit: false,
    quoteLine: "",
    orderBtnAmount: "",
    orderBtnTitle: "预约",
    showBookingPopup: false,
    showPortfolioPopup: false,
    portfolioPhotoCount: 0,
    cardHairColor: "",
    cardSkinColor: "",
    cardMeasureText: {
      height: "—",
      weight: "—",
      bust: "—",
      waist: "—",
      hip: "—",
      shoulder: "—",
      armSpan: "—",
      legLength: "—",
      shoeSize: "—"
    },
    /** 有模卡照片或模卡身材任一有效时展示模卡区块 */
    showCardPanel: false
  },

  cardMeasureHasAny(tm) {
    if (!tm || typeof tm !== "object") return false;
    return Object.values(tm).some(
      (v) => v != null && String(v).trim() !== "" && String(v) !== "—"
    );
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

  /** 校验 HTTP 2xx，避免 400 仍走 success 导致误判成功 */
  requestJson(url, method, data) {
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
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
            return;
          }
          reject({ statusCode: res.statusCode, data: res.data });
        },
        fail: reject
      });
    });
  },

  onLoad(options) {
    let userNo = options?.userNo || "";
    try {
      userNo = decodeURIComponent(userNo).trim();
    } catch (_e) {
      userNo = String(userNo).trim();
    }
    this.setData({ userNo });
    if (!userNo) {
      this.setData({ loading: false, loadError: "缺少模特编号" });
      return;
    }
    this.loadDetail(userNo);
  },

  collectImageUrls(model) {
    const angles = model?.card?.photoAngles || [];
    const cardUrls = angles.map((a) => a.url).filter(Boolean);
    return { cardUrls };
  },

  buildPortfolioSections(model) {
    const pf = model?.portfolio || {};
    const folders = Array.isArray(pf.folders) ? pf.folders : [];
    const photos = Array.isArray(pf.photos) ? pf.photos : [];
    if (!photos.length) return [];
    if (!folders.length) {
      const urls = photos.map((p) => p && p.url).filter(Boolean);
      return urls.length ? [{ id: "all", name: "作品集", urls }] : [];
    }
    return folders
      .map((f) => {
        const fps = photos.filter((p) => p.folderId === f.id);
        const cid = f.coverPhotoId;
        let ordered = fps;
        if (cid) {
          ordered = [...fps].sort((a, b) => {
            if (a.id === cid) return -1;
            if (b.id === cid) return 1;
            return 0;
          });
        }
        return {
          id: f.id,
          name: f.name || "未命名",
          urls: ordered.map((p) => p.url).filter(Boolean)
        };
      })
      .filter((s) => s.urls.length > 0);
  },

  buildBookableDateOptions(scheduleMap) {
    const map = scheduleMap && typeof scheduleMap === "object" ? scheduleMap : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + 29);
    const todayKey = formatDateKey(today);
    const maxKey = formatDateKey(max);

    const keys = Object.keys(map)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= todayKey && k <= maxKey)
      .filter((k) => String(map[k]).trim() === "available")
      .sort();

    return keys.map((dateKey) => {
      const parts = dateKey.split("-");
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const day = Number(parts[2]);
      const d = new Date(y, m - 1, day);
      d.setHours(0, 0, 0, 0);
      const w = WEEK[d.getDay()];
      return {
        dateKey,
        label: `${dateKey} 周${w}`,
        labelShort: `${m}/${day} 周${w}`
      };
    });
  },

  fmtMoney(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    const r = Math.round(x * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r);
  },

  fmtMeasure(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const r = Math.round(x * 100) / 100;
    return Number.isInteger(r) ? String(Math.trunc(r)) : String(r);
  },

  buildCardMeasureText(model) {
    const m = (model && model.card && model.card.measurements) || {};
    return {
      height: this.fmtMeasure(m.height),
      weight: this.fmtMeasure(m.weight),
      bust: this.fmtMeasure(m.bust),
      waist: this.fmtMeasure(m.waist),
      hip: this.fmtMeasure(m.hip),
      shoulder: this.fmtMeasure(m.shoulder),
      armSpan: this.fmtMeasure(m.armSpan),
      legLength: this.fmtMeasure(m.legLength),
      shoeSize: this.fmtMeasure(m.shoeSize)
    };
  },

  /** 根据当前时长选择更新底部报价文案与按钮金额（可不选日期先预览） */
  refreshQuoteDisplay() {
    const { durationKind, hourCount, model, canSubmit } = this.data;
    if (!model || !durationKind) {
      this.setData({ quoteLine: "", orderBtnAmount: "", orderBtnTitle: "下单" });
      return;
    }
    const p = model.price || {};
    let quoteLine = "";
    let orderBtnAmount = "";

    if (durationKind === "fullDay" && p.fullDay != null) {
      const amt = this.fmtMoney(p.fullDay);
      quoteLine = `单价（全天一口价）${amt} 元`;
      orderBtnAmount = amt;
    } else if (durationKind === "halfDay" && p.halfDay != null) {
      const amt = this.fmtMoney(p.halfDay);
      quoteLine = `单价（半天一口价）${amt} 元`;
      orderBtnAmount = amt;
    } else if (durationKind === "hourly" && p.hourly != null) {
      const h = Math.min(Math.max(Number(hourCount) || 1, 1), HOUR_MAX);
      const unit = this.fmtMoney(p.hourly);
      const total = Math.round(Number(p.hourly) * h * 100) / 100;
      const totalStr = this.fmtMoney(total);
      quoteLine = `单价 ${unit} 元/小时 · ${h} 小时 · 合计 ${totalStr} 元`;
      orderBtnAmount = totalStr;
    }

    const orderBtnTitle =
      orderBtnAmount && canSubmit ? `确认预约 ¥${orderBtnAmount}` : orderBtnAmount ? `¥${orderBtnAmount}` : "预约";

    this.setData({ quoteLine, orderBtnAmount, orderBtnTitle });
  },

  syncDurationIfInvalid(model) {
    const { durationKind } = this.data;
    if (!durationKind) return;
    const p = model?.price || {};
    const ok =
      (durationKind === "fullDay" && p.fullDay != null) ||
      (durationKind === "halfDay" && p.halfDay != null) ||
      (durationKind === "hourly" && p.hourly != null);
    if (!ok) {
      this.setData({ durationKind: "" });
    }
  },

  updateCanSubmit() {
    const { selectedDateKey, durationKind, hourCount, model } = this.data;
    const fail = () => {
      this.setData({ canSubmit: false }, () => this.refreshQuoteDisplay());
    };
    const ok = () => {
      this.setData({ canSubmit: true }, () => this.refreshQuoteDisplay());
    };

    if (!selectedDateKey || !durationKind || !model) {
      fail();
      return;
    }
    const p = model.price || {};
    if (durationKind === "fullDay" && p.fullDay == null) {
      fail();
      return;
    }
    if (durationKind === "halfDay" && p.halfDay == null) {
      fail();
      return;
    }
    if (durationKind === "hourly") {
      if (p.hourly == null) {
        fail();
        return;
      }
      const h = Number(hourCount);
      if (!Number.isFinite(h) || h < 1 || h > HOUR_MAX) {
        fail();
        return;
      }
    }
    ok();
  },

  async loadDetail(userNo) {
    this.setData({
      loading: true,
      loadError: "",
      selectedDateKey: "",
      durationKind: "",
      hourCount: 2,
      hourIndex: 1,
      canSubmit: false,
      quoteLine: "",
      orderBtnAmount: "",
      orderBtnTitle: "预约",
      showBookingPopup: false,
      showPortfolioPopup: false
    });
    try {
      const data = await this.requestWithAuth("/api/models/detail", "GET", { userNo });
      if (!data?.ok) {
        this.setData({
          loading: false,
          loadError: data?.message || "加载失败",
          model: null,
          cardUrls: [],
          portfolioSections: [],
          bookableDateOptions: [],
          quoteLine: "",
          orderBtnAmount: "",
          orderBtnTitle: "预约",
          showBookingPopup: false,
          showPortfolioPopup: false,
          portfolioPhotoCount: 0,
          showCardPanel: false
        });
        wx.showToast({
          title: data?.message || "加载失败",
          icon: "none"
        });
        return;
      }
      const model = { ...data };
      delete model.ok;
      const { cardUrls } = this.collectImageUrls(model);
      const portfolioSections = this.buildPortfolioSections(model);
      const portfolioPhotoCount = portfolioSections.reduce(
        (n, s) => n + (s.urls ? s.urls.length : 0),
        0
      );
      const scheduleMap = model.schedule && model.schedule.scheduleMap;
      const bookableDateOptions = this.buildBookableDateOptions(scheduleMap);
      const cardMeasureText = this.buildCardMeasureText(model);
      const card = (model && model.card) || {};
      const cardHairColor = String(card.hairColor || "").trim();
      const cardSkinColor = String(card.skinColor || "").trim();
      const showCardPanel =
        (cardUrls && cardUrls.length > 0) ||
        this.cardMeasureHasAny(cardMeasureText) ||
        Boolean(cardHairColor || cardSkinColor);
      this.setData({
        loading: false,
        loadError: "",
        model,
        cardUrls,
        portfolioSections,
        portfolioPhotoCount,
        bookableDateOptions,
        cardMeasureText,
        cardHairColor,
        cardSkinColor,
        showCardPanel
      });
      this.syncDurationIfInvalid(model);
      this.updateCanSubmit();
    } catch (_error) {
      this.setData({
        loading: false,
        loadError: "网络异常，请稍后重试",
        model: null,
        cardUrls: [],
        portfolioSections: [],
        bookableDateOptions: [],
        quoteLine: "",
        orderBtnAmount: "",
        orderBtnTitle: "预约",
        showBookingPopup: false,
        showPortfolioPopup: false,
        portfolioPhotoCount: 0,
        showCardPanel: false
      });
      wx.showToast({
        title: "网络异常",
        icon: "none"
      });
    }
  },

  onPickDate(e) {
    const key = e.currentTarget.dataset.key || "";
    if (!key) return;
    this.setData({ selectedDateKey: key });
    this.updateCanSubmit();
  },

  onPickDuration(e) {
    const kind = e.currentTarget.dataset.kind || "";
    if (!kind) return;
    if (kind === "hourly") {
      const h = Math.min(Math.max(Number(this.data.hourCount) || 2, 1), HOUR_MAX);
      this.setData({ durationKind: kind, hourCount: h, hourIndex: h - 1 }, () =>
        this.updateCanSubmit()
      );
      return;
    }
    this.setData({ durationKind: kind }, () => this.updateCanSubmit());
  },

  onHourPickerChange(e) {
    const idx = Number(e.detail.value);
    if (!Number.isFinite(idx) || idx < 0 || idx >= HOUR_MAX) return;
    const hourCount = idx + 1;
    this.setData({ hourIndex: idx, hourCount }, () => this.updateCanSubmit());
  },

  durationSummaryText() {
    const { selectedDateKey, durationKind, hourCount, model } = this.data;
    if (!selectedDateKey || !durationKind || !model) return "";
    const p = model.price || {};
    if (durationKind === "fullDay") {
      return `全天 · ${p.fullDay != null ? p.fullDay + " 元" : ""}`;
    }
    if (durationKind === "halfDay") {
      return `半天 · ${p.halfDay != null ? p.halfDay + " 元" : ""}`;
    }
    if (durationKind === "hourly") {
      const h = Number(hourCount) || 0;
      const unit = p.hourly != null ? p.hourly : "—";
      return `按小时 · ${h} 小时 · 约 ${unit} 元/小时`;
    }
    return "";
  },

  isMerchantRole() {
    const app = getApp();
    return Number(app.globalData.role) === 2;
  },

  async fetchMerchantContractSigned() {
    if (!this.isMerchantRole()) return true;
    try {
      const data = await this.requestWithAuth("/api/users/me", "GET");
      const user = data?.user;
      if (!data?.ok || !user) return false;
      return Boolean(user.contractPlatformMerchantSignedAt);
    } catch (_e) {
      return false;
    }
  },

  promptMerchantSignContract() {
    wx.showModal({
      title: "请先签署合同",
      content: "商家需签署「平台与商家服务合同」后，方可预约下单。",
      confirmText: "去签署",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: "/pages/contract-detail/contract-detail" });
        }
      }
    });
  },

  async onPlaceOrder() {
    if (!this.data.model) return;
    if (this.isMerchantRole()) {
      wx.showLoading({ title: "校验中", mask: true });
      const signed = await this.fetchMerchantContractSigned();
      wx.hideLoading();
      if (!signed) {
        this.promptMerchantSignContract();
        return;
      }
    }
    this.setData({ showBookingPopup: true });
  },

  onCloseBookingPopup() {
    this.setData({ showBookingPopup: false });
  },

  /** 阻止弹窗打开时触摸穿透到底层 scroll-view */
  preventTouchMove() {},

  /** 阻止点击弹窗内容时冒泡关闭，不影响内部 scroll-view 滚动 */
  preventPopupTapBubble() {},

  onOpenPortfolioPopup() {
    if (!this.data.portfolioSections.length) {
      wx.showToast({ title: "暂无作品集", icon: "none" });
      return;
    }
    this.setData({ showPortfolioPopup: true });
  },

  onClosePortfolioPopup() {
    this.setData({ showPortfolioPopup: false });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    const from = e.currentTarget.dataset.from || "";
    const sectionId = e.currentTarget.dataset.sectionId || "";
    let urls = [];
    if (from === "card") {
      urls = this.data.cardUrls || [];
    } else if (sectionId) {
      const sec = (this.data.portfolioSections || []).find((s) => s.id === sectionId);
      urls = sec && sec.urls ? sec.urls : [];
    }
    if (!urls.length) urls = [url];
    wx.previewImage({ current: url, urls });
  },

  async onConfirmBooking() {
    if (!this.data.canSubmit) {
      if (!this.data.selectedDateKey) {
        wx.showToast({ title: "请先选择预约日期", icon: "none" });
        return;
      }
      if (!this.data.durationKind) {
        wx.showToast({ title: "请选择服务时长", icon: "none" });
        return;
      }
      wx.showToast({ title: "请完善预约信息", icon: "none" });
      return;
    }
    if (this.isMerchantRole()) {
      wx.showLoading({ title: "校验中", mask: true });
      const signed = await this.fetchMerchantContractSigned();
      wx.hideLoading();
      if (!signed) {
        this.promptMerchantSignContract();
        return;
      }
    }
    const { selectedDateKey: date, durationKind, hourCount, model } = this.data;
    let summary = this.durationSummaryText();
    if (durationKind === "hourly" && model?.price?.hourly != null) {
      const h = Number(hourCount) || 0;
      const total = Math.round(Number(model.price.hourly) * h);
      summary += `\n参考合计：${total} 元（以服务端为准）`;
    }
    wx.showModal({
      title: "确认下单",
      content: `${date}\n${summary}\n\n首期提交即模拟支付成功并生成订单；首态为待模特确认接单。`,
      confirmText: "提交订单",
      cancelText: "再想想",
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.setData({ showBookingPopup: false });
          this.submitOrder();
        }
      }
    });
  },

  async submitOrder() {
    const { selectedDateKey: date, durationKind, hourCount, model } = this.data;
    if (!model?.userNo || !date || !durationKind) {
      return;
    }
    const body = {
      modelUserNo: model.userNo,
      bookingDate: date,
      durationKind
    };
    if (durationKind === "hourly") {
      body.hourCount = Number(hourCount);
    }
    wx.showLoading({ title: "提交中", mask: true });
    try {
      const data = await this.requestJson("/api/orders", "POST", body);
      wx.hideLoading();
      if (!data?.ok) {
        wx.showToast({ title: data?.message || "下单失败", icon: "none" });
        return;
      }
      const o = data.order || {};
      const id = o.orderId;
      wx.showToast({ title: "下单成功", icon: "success" });
      if (id) {
        setTimeout(
          () =>
            wx.redirectTo({
              url: `/pages/order-detail/order-detail?id=${id}`
            }),
          600
        );
      } else {
        setTimeout(() => wx.navigateBack(), 1200);
      }
    } catch (err) {
      wx.hideLoading();
      const msg =
        (err && err.data && (err.data.message || err.data.error)) || "网络异常，请重试";
      wx.showToast({ title: String(msg), icon: "none" });
    }
  }
});
