const {
  markLaunchIntroSeen,
  navigateAfterLaunchIntro,
  normalizeTargetUrl
} = require("../../utils/launch-intro.js");

const AUTO_ADVANCE_MS = 2000;

const SLIDES = [
  {
    id: "platform",
    theme: "violet",
    step: "01",
    kicker: "星链模库",
    title: "模特与商家更快相遇",
    desc: "模特展示、商单撮合、档期预约一站式完成，让合作从发现到履约更顺畅。",
    highlights: [
      { icon: "✦", text: "精选模特推荐" },
      { icon: "✦", text: "商单动态展示" },
      { icon: "✦", text: "在线预约合作" }
    ],
    visual: "stats"
  },
  {
    id: "roles",
    theme: "rose",
    step: "02",
    kicker: "多角色协作",
    title: "为每种身份打造专属入口",
    desc: "注册并选择身份后，模特、客户、经纪人、代理人各有独立工作台与能力。",
    highlights: [
      { icon: "M", text: "模特：接单与档期管理" },
      { icon: "C", text: "客户：筛选下单与评价" },
      { icon: "B", text: "经纪人：推广与团队数据" }
    ],
    visual: "roles"
  },
  {
    id: "trust",
    theme: "sky",
    step: "03",
    kicker: "透明可信赖",
    title: "规则清晰，合作可追溯",
    desc: "坚持流程标准化、数据透明与风控合规，订单与资金记录可查询、可核对。",
    highlights: [
      { icon: "✓", text: "不强制消费、不捆绑拍摄" },
      { icon: "✓", text: "交易与分账可追踪" },
      { icon: "✓", text: "争议处理有闭环" }
    ],
    visual: "trust"
  }
];

Page({
  data: {
    slides: SLIDES,
    current: 0,
    isLast: false,
    themeClass: "launch-theme--violet",
    stepText: "01 / 03",
    progressWidth: "33.33%",
    targetUrl: "/pages/home-intro/home-intro",
    safeTop: 24,
    safeBottom: 24,
    swiperHeight: 400
  },

  onLoad(options) {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const safeBottom =
      (systemInfo.safeArea && systemInfo.screenHeight
        ? systemInfo.screenHeight - systemInfo.safeArea.bottom
        : 0) || 0;
    this.setData({
      targetUrl: normalizeTargetUrl(options && options.target ? decodeURIComponent(options.target) : ""),
      safeTop: statusBarHeight + 8,
      safeBottom: Math.max(safeBottom, 12),
      swiperHeight: this.estimateSwiperHeight(systemInfo, statusBarHeight, safeBottom)
    });
    this.syncSlideMeta(0);
    this.startAutoAdvance();
  },

  onReady() {
    this.measureSwiperHeight();
  },

  onUnload() {
    this.clearAutoAdvance();
  },

  startAutoAdvance() {
    this.clearAutoAdvance();
    this._autoTimer = setTimeout(() => {
      this._autoTimer = null;
      this.goNext();
    }, AUTO_ADVANCE_MS);
  },

  clearAutoAdvance() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
  },

  /** 真机 flex:1 + height:0 常导致 swiper 高度为 0，先用窗口高度估算 */
  estimateSwiperHeight(systemInfo, statusBarHeight, safeBottom) {
    const windowHeight = systemInfo.windowHeight || 667;
    const topBlock = statusBarHeight + 8 + 52 + 58;
    const bottomBlock = 150 + Math.max(safeBottom, 12);
    return Math.max(Math.floor(windowHeight - topBlock - bottomBlock), 280);
  },

  measureSwiperHeight() {
    const query = wx.createSelectorQuery().in(this);
    query.select(".launch-header").boundingClientRect();
    query.select(".launch-step-bar").boundingClientRect();
    query.select(".launch-footer").boundingClientRect();
    query.exec((rects) => {
      if (!rects || !rects.length) return;
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const windowHeight = systemInfo.windowHeight || 667;
      const used = rects.reduce((sum, rect) => sum + (rect && rect.height ? rect.height : 0), 0);
      const swiperHeight = Math.max(Math.floor(windowHeight - used), 280);
      if (swiperHeight !== this.data.swiperHeight) {
        this.setData({ swiperHeight });
      }
    });
  },

  syncSlideMeta(index) {
    const slide = SLIDES[index] || SLIDES[0];
    const progress = ((index + 1) / SLIDES.length) * 100;
    this.setData({
      themeClass: `launch-theme--${slide.theme}`,
      stepText: `${slide.step} / 03`,
      progressWidth: `${progress}%`,
      isLast: index >= SLIDES.length - 1
    });
  },

  onSwiperChange(e) {
    const current = Number(e.detail.current || 0);
    this.setData({ current });
    this.syncSlideMeta(current);
    this.startAutoAdvance();
  },

  goNext() {
    this.clearAutoAdvance();
    if (this.data.isLast) {
      this.finish();
      return;
    }
    const next = this.data.current + 1;
    this.setData({ current: next });
    this.syncSlideMeta(next);
    this.startAutoAdvance();
  },

  skip() {
    this.clearAutoAdvance();
    this.finish();
  },

  finish() {
    this.clearAutoAdvance();
    markLaunchIntroSeen();
    navigateAfterLaunchIntro(this.data.targetUrl);
  }
});
