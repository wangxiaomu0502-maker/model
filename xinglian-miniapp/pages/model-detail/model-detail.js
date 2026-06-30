const HOUR_MAX = 8;
const { extractModelUserNoFromEntry } = require("../../utils/model-promo-scan.js");

function getSafeAreaBottomPx() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const safeBottom = info.safeArea && typeof info.safeArea.bottom === "number"
      ? info.safeArea.bottom
      : info.windowHeight;
    const gap = Number(info.windowHeight || 0) - Number(safeBottom || 0);
    return Math.max(0, gap);
  } catch (_e) {
    return 0;
  }
}

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
const MERCHANT_ONLY_ORDER_HINT = "仅客户可预约下单";
const PROFILE_AUDIT_ORDER_HINT = "资料审核暂未通过，请稍后下单";

Page({
  data: {
    userNo: "",
    loading: true,
    loadError: "",
    model: null,
    cardUrls: [],
    stylePositionPhotos: [],
    honors: [],
    portfolioSections: [],
    bookableDateOptions: [],
    selectedDateKey: "",
    serviceType: "ordinary",
    durationKind: "",
    hourCount: 2,
    hourIndex: 1,
    hourLabels: Array.from({ length: HOUR_MAX }, (_, i) => `${i + 1} 小时`),
    canSubmit: false,
    quoteLine: "",
    orderBtnAmount: "",
    orderBtnTitle: "预约",
    merchantRemark: "",
    showBookingPopup: false,
    showPortfolioPopup: false,
    portfolioPhotoCount: 0,
    cardPhotoItems: [],
    cardPrimaryMetrics: [],
    cardSecondaryMetrics: [],
    cardStyleTags: [],
    cardHairColor: "",
    cardSkinColor: "",
    isVisitor: false,
    /** 模特/经纪人身份：不可预约，底栏仅展示提示文案 */
    bookingRestricted: false,
    safeAreaBottomPx: 0,
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
    showCardPanel: false,
    showStylePanel: false,
    showHonorsPanel: false,
    showPortfolioPanel: false,
    cardSwiperIndex: 0,
    cardSwiperPageText: ""
  },

  cardSwiperState(cardCount) {
    const total = Number(cardCount) || 0;
    return {
      cardSwiperIndex: 0,
      cardSwiperPageText: total > 0 ? `1 / ${total}` : ""
    };
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
  async cancelOrderAfterPaymentCancel(orderId) {
    try {
      await this.requestJson(`/api/orders/${orderId}/cancel`, "POST", { reason: "用户取消支付" });
      return true;
    } catch (err) {
      console.warn("cancel unpaid order after payment cancel failed", err);
      return false;
    }
  },

  async syncOrderPayment(orderId) {
    try {
      return await this.requestJson(`/api/orders/${orderId}/sync-pay`, "POST", {});
    } catch (err) {
      console.warn("sync order payment failed", err);
      return null;
    }
  },

  async requestWechatPay(orderId) {
    wx.showLoading({ title: "调起支付", mask: true });
    try {
      const data = await this.requestJson(`/api/orders/${orderId}/pay`, "POST", {});
      wx.hideLoading();
      if (!data?.ok || !data.payment) {
        wx.showToast({ title: data?.message || "获取支付参数失败", icon: "none" });
        setTimeout(
          () =>
            wx.redirectTo({
              url: `/pages/order-detail/order-detail?id=${orderId}`
            }),
          800
        );
        return;
      }
      const p = data.payment;
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType || "RSA",
          paySign: p.paySign,
          success: resolve,
          fail: reject
        });
      });
      const synced = await this.syncOrderPayment(orderId);
      const paid = synced?.ok && Number(synced.paymentStatus) === 1;
      wx.showToast({ title: paid ? "支付成功" : "支付处理中", icon: paid ? "success" : "none" });
      setTimeout(
        () =>
          wx.redirectTo({
            url: `/pages/order-detail/order-detail?id=${orderId}`
          }),
        600
      );
    } catch (err) {
      wx.hideLoading();
      const msg = (err && err.errMsg) || (err && err.message) || "支付未完成";
      if (String(msg).indexOf("cancel") >= 0 || String(msg).indexOf("取消") >= 0) {
        const closed = await this.cancelOrderAfterPaymentCancel(orderId);
        wx.showToast({ title: closed ? "已取消支付，订单已关闭" : "已取消支付", icon: "none" });
      } else {
        wx.showToast({ title: String(msg), icon: "none" });
      }
      setTimeout(
        () =>
          wx.redirectTo({
            url: `/pages/order-detail/order-detail?id=${orderId}`
          }),
        800
      );
    }
  },

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

  async fetchMerchantOrderEnabled() {
    try {
      const data = await this.requestJson("/api/system-settings/merchant-order-setting", "GET", {});
      return data?.merchantOrderEnabled !== false;
    } catch (err) {
      console.warn("fetch merchant order setting failed", err);
      return true;
    }
  },

  isVisitorUser() {
    const app = getApp();
    return !app.globalData.token || Number(app.globalData.role || 0) === 0;
  },

  isModelOrBrokerRole() {
    const role = Number(getApp().globalData.role || 0);
    return role === 1 || role === 3;
  },

  isBookingRestrictedForCurrentUser() {
    return this.isModelOrBrokerRole();
  },

  defaultOrderBtnTitle() {
    if (this.isVisitorUser()) return "注册后预约";
    if (this.isBookingRestrictedForCurrentUser()) return MERCHANT_ONLY_ORDER_HINT;
    return "预约";
  },

  syncBookingAccessState() {
    const bookingRestricted = this.isBookingRestrictedForCurrentUser();
    const patch = { bookingRestricted };
    if (bookingRestricted) {
      patch.orderBtnTitle = MERCHANT_ONLY_ORDER_HINT;
    } else if (!this.data.showBookingPopup) {
      patch.orderBtnTitle = this.defaultOrderBtnTitle();
    }
    this.setData(patch);
    if (!bookingRestricted && this.data.model) {
      this.refreshQuoteDisplay();
    }
  },

  onLoad(options) {
    let userNo = extractModelUserNoFromEntry(options || {});
    if (!userNo && options?.userNo) {
      try {
        userNo = decodeURIComponent(String(options.userNo)).trim();
      } catch (_e) {
        userNo = String(options.userNo).trim();
      }
    }
    this.setData({
      userNo,
      isVisitor: this.isVisitorUser(),
      bookingRestricted: this.isBookingRestrictedForCurrentUser(),
      orderBtnTitle: this.defaultOrderBtnTitle()
    });
    this.setData({
      safeAreaBottomPx: getSafeAreaBottomPx()
    });
    if (!userNo) {
      this.setData({ loading: false, loadError: "缺少模特编号" });
      return;
    }
    this.loadDetail(userNo);
  },

  onShow() {
    this.syncBookingAccessState();
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

  buildStylePositionPhotos(model) {
    const sp = model?.stylePosition || {};
    const photos = Array.isArray(sp.photos) ? sp.photos : [];
    return photos.map((p) => p && p.url).filter(Boolean);
  },

  buildHonors(model) {
    const list = Array.isArray(model?.honors) ? model.honors : [];
    return list
      .map((item) => ({
        id: item.id,
        title: String(item.title || "").trim(),
        imageUrl: item.imageUrl ? String(item.imageUrl).trim() : ""
      }))
      .filter((item) => item.title);
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

  measureFilled(v) {
    return v != null && String(v).trim() !== "" && String(v) !== "—";
  },

  buildCardDisplayData(model, cardUrls) {
    const tm = this.buildCardMeasureText(model);
    const has = (key) => this.measureFilled(tm[key]);
    const card = (model && model.card) || {};
    const cardHairColor = String(card.hairColor || "").trim();
    const cardSkinColor = String(card.skinColor || "").trim();
    const cardPhotoItems = (cardUrls || []).map((url) => ({ url }));
    const cardPrimaryMetrics = [];
    const addPrimary = (key, label, unit) => {
      if (has(key)) {
        cardPrimaryMetrics.push({ label, value: tm[key], unit });
      }
    };

    addPrimary("height", "身高", "cm");
    addPrimary("weight", "体重", "kg");
    if (has("bust") || has("waist") || has("hip")) {
      cardPrimaryMetrics.push({
        label: "三围",
        value: `${tm.bust}/${tm.waist}/${tm.hip}`,
        unit: "cm"
      });
    }

    const secondaryMap = [
      ["shoulder", "肩宽", "cm"],
      ["armSpan", "臂展", "cm"],
      ["legLength", "腿长", "cm"],
      ["shoeSize", "鞋码", ""]
    ];
    const cardSecondaryMetrics = secondaryMap
      .filter(([key]) => has(key))
      .map(([key, label, unit]) => ({ label, value: tm[key], unit }));
    const cardStyleTags = [
      cardHairColor ? `发色 ${cardHairColor}` : "",
      cardSkinColor ? `肤色 ${cardSkinColor}` : ""
    ].filter(Boolean);

    return {
      cardMeasureText: tm,
      cardHairColor,
      cardSkinColor,
      cardPhotoItems,
      cardPrimaryMetrics,
      cardSecondaryMetrics,
      cardStyleTags
    };
  },

  /** 根据当前时长选择更新底部报价文案与按钮金额（可不选日期先预览） */
  refreshQuoteDisplay() {
    const { durationKind, hourCount, model, canSubmit, serviceType } = this.data;
    if (!model || !durationKind) {
      this.setData({ quoteLine: "", orderBtnAmount: "", orderBtnTitle: this.defaultOrderBtnTitle() });
      return;
    }
    const p = model.price || {};
    let quoteLine = "";
    let orderBtnAmount = "";

    if (durationKind === "fullDay" && p.fullDay != null) {
      const amt = this.fmtMoney(p.fullDay);
      quoteLine = `单价（全天一口价）${amt} 元 · ${serviceType === "agent" ? "代理服务" : "普通服务"}`;
      orderBtnAmount = amt;
    } else if (durationKind === "halfDay" && p.halfDay != null) {
      const amt = this.fmtMoney(p.halfDay);
      quoteLine = `单价（半天一口价）${amt} 元 · ${serviceType === "agent" ? "代理服务" : "普通服务"}`;
      orderBtnAmount = amt;
    } else if (durationKind === "hourly" && p.hourly != null) {
      const h = Math.min(Math.max(Number(hourCount) || 1, 1), HOUR_MAX);
      const unit = this.fmtMoney(p.hourly);
      const total = Math.round(Number(p.hourly) * h * 100) / 100;
      const totalStr = this.fmtMoney(total);
      quoteLine = `单价 ${unit} 元/小时 · ${h} 小时 · 合计 ${totalStr} 元 · ${serviceType === "agent" ? "代理服务" : "普通服务"}`;
      orderBtnAmount = totalStr;
    }

    let orderBtnTitle =
      orderBtnAmount && canSubmit ? `确认预约 ¥${orderBtnAmount}` : orderBtnAmount ? `¥${orderBtnAmount}` : "预约";
    if (this.isVisitorUser()) {
      orderBtnTitle = "注册后预约";
    } else if (this.isBookingRestrictedForCurrentUser()) {
      orderBtnTitle = MERCHANT_ONLY_ORDER_HINT;
    }

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
      serviceType: "ordinary",
      durationKind: "",
      hourCount: 2,
      hourIndex: 1,
      canSubmit: false,
      quoteLine: "",
      orderBtnAmount: "",
      orderBtnTitle: this.defaultOrderBtnTitle(),
      merchantRemark: "",
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
          stylePositionPhotos: [],
          honors: [],
          portfolioSections: [],
          bookableDateOptions: [],
          quoteLine: "",
          orderBtnAmount: "",
          orderBtnTitle: this.defaultOrderBtnTitle(),
          merchantRemark: "",
          showBookingPopup: false,
          showPortfolioPopup: false,
          portfolioPhotoCount: 0,
          showCardPanel: false,
          showStylePanel: false,
          showHonorsPanel: false,
          showPortfolioPanel: false
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
      const stylePositionPhotos = this.buildStylePositionPhotos(model);
      const honors = this.buildHonors(model);
      const portfolioSections = this.buildPortfolioSections(model);
      const portfolioPhotoCount = portfolioSections.reduce(
        (n, s) => n + (s.urls ? s.urls.length : 0),
        0
      );
      const scheduleMap = model.schedule && model.schedule.scheduleMap;
      const bookableDateOptions = this.buildBookableDateOptions(scheduleMap);
      const cardDisplay = this.buildCardDisplayData(model, cardUrls);
      const showCardPanel =
        (cardUrls && cardUrls.length > 0) ||
        this.cardMeasureHasAny(cardDisplay.cardMeasureText) ||
        Boolean(cardDisplay.cardHairColor || cardDisplay.cardSkinColor);
      this.setData({
        loading: false,
        loadError: "",
        model,
        cardUrls,
        stylePositionPhotos,
        honors,
        portfolioSections,
        portfolioPhotoCount,
        bookableDateOptions,
        ...cardDisplay,
        showCardPanel,
        showStylePanel: stylePositionPhotos.length > 0,
        showHonorsPanel: honors.length > 0,
        showPortfolioPanel: portfolioSections.length > 0,
        ...this.cardSwiperState(cardUrls.length)
      });
      this.syncDurationIfInvalid(model);
      this.updateCanSubmit();
    } catch (_error) {
      this.setData({
        loading: false,
        loadError: "网络异常，请稍后重试",
        model: null,
        cardUrls: [],
        stylePositionPhotos: [],
        portfolioSections: [],
        bookableDateOptions: [],
        quoteLine: "",
        orderBtnAmount: "",
        orderBtnTitle: this.defaultOrderBtnTitle(),
        merchantRemark: "",
        showBookingPopup: false,
        showPortfolioPopup: false,
        portfolioPhotoCount: 0,
        showCardPanel: false,
        showStylePanel: false,
        showPortfolioPanel: false
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

  onPickServiceType(e) {
    const serviceType = e.currentTarget.dataset.serviceType || "";
    if (serviceType !== "ordinary" && serviceType !== "agent") return;
    this.setData({ serviceType }, () => this.refreshQuoteDisplay());
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

  onMerchantRemarkInput(e) {
    const value = String(e.detail.value || "").slice(0, 500);
    this.setData({ merchantRemark: value });
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
      content: "客户需签署「平台与客户服务合同」后，方可预约下单。",
      confirmText: "去签署",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: "/pages/contract-detail/contract-detail" });
        }
      }
    });
  },

  isModelProfileAuditApproved() {
    return Number(this.data.model?.profileAuditStatus || 0) === 2;
  },

  promptModelProfileAuditPending() {
    wx.showModal({
      title: "暂不可下单",
      content: PROFILE_AUDIT_ORDER_HINT,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  async onPlaceOrder() {
    if (!this.data.model) return;
    if (this.isVisitorUser()) {
      this.promptRegister();
      return;
    }
    if (this.isBookingRestrictedForCurrentUser()) {
      return;
    }
    if (!this.isModelProfileAuditApproved()) {
      this.promptModelProfileAuditPending();
      return;
    }
    if (this.isMerchantRole()) {
      wx.showLoading({ title: "校验中", mask: true });
      const orderEnabled = await this.fetchMerchantOrderEnabled();
      if (!orderEnabled) {
        wx.hideLoading();
        wx.showModal({
          title: "暂不可下单",
          content: "目前客户不允许下单，请联系管理员",
          showCancel: false,
          confirmText: "知道了"
        });
        return;
      }
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

  goRegister() {
    wx.navigateTo({
      url: "/pages/intro/intro"
    });
  },

  promptRegister() {
    wx.showModal({
      title: "注册后可预约",
      content: "当前可先浏览模特详情。注册并选择身份后，即可发起预约与管理订单。",
      confirmText: "去注册",
      cancelText: "继续浏览",
      success: (res) => {
        if (res.confirm) {
          this.goRegister();
        }
      }
    });
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

  onCardSwiperChange(e) {
    const idx = Number(e.detail.current) || 0;
    const total = (this.data.cardUrls || []).length;
    this.setData({
      cardSwiperIndex: idx,
      cardSwiperPageText: total > 0 ? `${idx + 1} / ${total}` : ""
    });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    const from = e.currentTarget.dataset.from || "";
    const sectionId = e.currentTarget.dataset.sectionId || "";
    let urls = [];
    if (from === "card") {
      urls = this.data.cardUrls || [];
    } else if (from === "stylePosition") {
      urls = this.data.stylePositionPhotos || [];
    } else if (from === "honor") {
      urls = (this.data.honors || []).map((h) => h.imageUrl).filter(Boolean);
    } else if (sectionId) {
      const sec = (this.data.portfolioSections || []).find((s) => s.id === sectionId);
      urls = sec && sec.urls ? sec.urls : [];
    }
    if (!urls.length) urls = [url];
    wx.previewImage({ current: url, urls });
  },

  async onConfirmBooking() {
    if (this.isVisitorUser()) {
      this.promptRegister();
      return;
    }
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
    if (!this.isModelProfileAuditApproved()) {
      this.promptModelProfileAuditPending();
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
    const { selectedDateKey: date, serviceType, durationKind, hourCount, model, merchantRemark } = this.data;
    let summary = this.durationSummaryText();
    summary = `${serviceType === "agent" ? "代理服务（提供影棚）" : "普通服务"}\n${summary}`;
    if (durationKind === "hourly" && model?.price?.hourly != null) {
      const h = Number(hourCount) || 0;
      const total = Math.round(Number(model.price.hourly) * h);
      summary += `\n参考合计：${total} 元（以服务端为准）`;
    }
    const remarkText = String(merchantRemark || "").trim();
    if (remarkText) {
      summary += `\n备注：${remarkText}`;
    }
    wx.showModal({
      title: "确认下单",
      content: `${date}\n${summary}\n\n提交后将创建订单并调起微信支付；支付成功后待模特确认接单。`,
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
    if (this.isVisitorUser()) {
      this.promptRegister();
      return;
    }
    const { selectedDateKey: date, serviceType, durationKind, hourCount, model, merchantRemark } = this.data;
    if (!model?.userNo || !date || !durationKind) {
      return;
    }
    if (!this.isModelProfileAuditApproved()) {
      this.promptModelProfileAuditPending();
      return;
    }
    const body = {
      modelUserNo: model.userNo,
      bookingDate: date,
      serviceType,
      durationKind
    };
    if (durationKind === "hourly") {
      body.hourCount = Number(hourCount);
    }
    const remarkText = String(merchantRemark || "").trim();
    if (remarkText) {
      body.merchantRemark = remarkText;
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
      if (o.needPay && o.paymentMode === "wechat" && id) {
        await this.requestWechatPay(id);
        return;
      }
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
