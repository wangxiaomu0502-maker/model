const { goModelListByHomeCategory } = require("../utils/home-model-categories.js");
const {
  featuredModelsDataDefaults,
  loadHomeFeaturedModels,
  loadMoreHomeFeaturedModels
} = require("../utils/home-featured-models.js");
const { buildHomeBusinessTickerItems } = require("../utils/business-showcase-cases.js");
const {
  HOME_MODEL_LEVELS,
  HOME_BANNERS,
  HOME_MODEL_SKY_BADGE_ICON,
  HOME_MODEL_SKY_NAME_BADGE_ICON
} = require("../utils/home-model-levels.js");
const {
  openHomeBannerPreview,
  closeHomeBannerVideoPreview,
  onHomeBannerVideoError,
  preventBannerPreviewBubble
} = require("../utils/home-banner-preview.js");
const { scanAndOpenModelDetail } = require("../utils/model-promo-scan.js");
const { switchToModelListTab } = require("../utils/model-list-navigation.js");
const { HOME_QUICK_ENTRIES } = require("../utils/home-quick-entries.js");
const {
  calcHomeScrollShieldThreshold,
  refreshHomeScrollShield
} = require("../utils/home-page-scroll.js");

const PRIMARY_QUICK_ENTRIES = HOME_QUICK_ENTRIES.slice(0, 4);
const SECONDARY_QUICK_ENTRIES = HOME_QUICK_ENTRIES.slice(4);

const HOME_HEADER_BG =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782725489204-bmzbcjkq.png";

const HOME_SCAN_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782727546775-6yv1s3sy.png";

const HOME_SEARCH_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782727616382-3okk9sg4.png";

const HOME_BUSINESS_TICKER_LEADING_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782805016617-qx476wah.png";

const HOME_BUSINESS_TICKER_MORE_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782805152330-c0mfobf0.png";

const HOME_FEATURED_MODELS_TITLE_IMG =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782814535332-2btd41hs.png";

const HOME_MODEL_LOCATION_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782814610334-xv322yh4.png";

module.exports = Behavior({
  data: {
    modelCount: "--",
    brokerCount: "--",
    merchantCount: "--",
    homeModelLevels: HOME_MODEL_LEVELS,
    activeLevelIndex: 1,
    homeHeaderBg: HOME_HEADER_BG,
    homeScanIconSrc: HOME_SCAN_ICON,
    homeSearchIconSrc: HOME_SEARCH_ICON,
    homeBusinessTickerLeadingIconSrc: HOME_BUSINESS_TICKER_LEADING_ICON,
    homeBusinessTickerMoreIconSrc: HOME_BUSINESS_TICKER_MORE_ICON,
    homeFeaturedModelsTitleImgSrc: HOME_FEATURED_MODELS_TITLE_IMG,
    homeModelLocationIconSrc: HOME_MODEL_LOCATION_ICON,
    homeModelSkyBadgeIconSrc: HOME_MODEL_SKY_BADGE_ICON,
    homeModelSkyNameBadgeIconSrc: HOME_MODEL_SKY_NAME_BADGE_ICON,
    scanIconLoadError: false,
    statusBarHeight: 20,
    navBarHeight: 88,
    navRowHeight: 44,
    navPaddingTop: 20,
    banners: HOME_BANNERS,
    businessTickerItems: buildHomeBusinessTickerItems(),
    quickEntries: HOME_QUICK_ENTRIES,
    primaryQuickEntries: PRIMARY_QUICK_ENTRIES,
    secondaryQuickEntries: SECONDARY_QUICK_ENTRIES,
    ...featuredModelsDataDefaults(),
    loading: false,
    loadError: "",
    bannerVideoVisible: false,
    bannerVideoUrl: "",
    bannerVideoCover: "",
    bannerCurrent: 0,
    homeScrolled: false,
    homeScrollShieldThreshold: 12
  },

  attached() {
    this.initHomeLayoutMetrics();
  },

  methods: {
    initHomeLayoutMetrics() {
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBarHeight = systemInfo.statusBarHeight || 20;
      let navBarHeight = statusBarHeight + 44;
      let navRowHeight = 44;
      let navPaddingTop = statusBarHeight;

      try {
        const menuButton = wx.getMenuButtonBoundingClientRect();
        navPaddingTop = menuButton.top;
        navRowHeight = menuButton.height;
        navBarHeight = menuButton.top + menuButton.height;
      } catch (error) {
        // 开发者工具或未就绪时沿用默认值
      }

      this.setData({
        statusBarHeight,
        navBarHeight,
        navRowHeight,
        navPaddingTop,
        homeScrollShieldThreshold: calcHomeScrollShieldThreshold(systemInfo)
      });
    },

    refreshHomeScrollShield() {
      refreshHomeScrollShield(this);
    },

    loadHomeData() {
      const app = getApp();
      this.setData({ loading: true, loadError: "" });
      this.loadSummary(app);
      this.loadBanners(app);
      loadHomeFeaturedModels(this);
    },

    loadBanners(app) {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/home-banners`,
        method: "GET",
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !Array.isArray(body.list) || !body.list.length) {
            return;
          }
          this.setData({ banners: body.list, bannerCurrent: 0 });
        }
      });
    },

    loadSummary(app) {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/models/home-summary`,
        method: "GET",
        header: {
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok) return;
          this.setData({
            modelCount: Number(body.modelCount || 0),
            brokerCount: Number(body.brokerCount || 0),
            merchantCount: Number(body.merchantCount || 0)
          });
        }
      });
    },

    onReachBottom() {
      loadMoreHomeFeaturedModels(this);
    },

    goModelList() {
      switchToModelListTab();
    },

    goSearchPage() {
      wx.navigateTo({ url: "/pages/home-search/home-search" });
    },

    goBusinessShowcase() {
      wx.navigateTo({ url: "/pages/business-showcase/business-showcase" });
    },

    goBannerDetail(e) {
      const id = Number(e.currentTarget.dataset.id || 0);
      if (!id) return;
      openHomeBannerPreview(this, id);
    },

    onBannerChange(e) {
      const current = Number(e.detail?.current || 0);
      this.setData({ bannerCurrent: current });
    },

    closeBannerVideo() {
      closeHomeBannerVideoPreview(this);
    },

    preventBannerPreviewBubble,

    onBannerVideoError(e) {
      onHomeBannerVideoError(this, e);
    },

    onScanTap() {
      scanAndOpenModelDetail();
    },

    onScanIconError() {
      this.setData({ scanIconLoadError: true });
    },

    onModelLevelTap(e) {
      const levelIndex = Number(e.currentTarget.dataset.levelIndex || 0);
      const levelItem = HOME_MODEL_LEVELS.find((item) => item.levelIndex === levelIndex);
      if (!levelItem) return;

      this.setData({ activeLevelIndex: levelIndex });

      const app = getApp();
      app.globalData.pendingModelListFilter = {
        levelIndex: levelItem.levelIndex,
        categoryLabel: `${levelItem.shortCode} ${levelItem.shortName}`,
        ts: Date.now()
      };
      switchToModelListTab();
    },

    goModelDetail(e) {
      const userNo = e.currentTarget.dataset.userNo || "";
      if (!userNo) return;
      wx.navigateTo({
        url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
      });
    },

    goBrokerIntro() {
      wx.navigateTo({ url: "/pages/broker-intro/broker-intro" });
    },

    goMerchantIntro() {
      wx.navigateTo({ url: "/pages/merchant-intro/merchant-intro" });
    },

    onQuickEntryTap(e) {
      const key = e.currentTarget.dataset.key || "";

      switch (key) {
        case "model":
          switchToModelListTab();
          break;
        case "actor":
          goModelListByHomeCategory("actor");
          break;
        case "broker":
          wx.navigateTo({ url: "/pages/broker-intro/broker-intro" });
          break;
        case "merchant":
          wx.navigateTo({ url: "/pages/merchant-intro/merchant-intro" });
          break;
        case "shoot":
          wx.navigateTo({ url: "/pages/commercial-shoot-center/commercial-shoot-center" });
          break;
        case "training":
          wx.navigateTo({ url: "/pages/model-training/model-training" });
          break;
        case "contest":
          wx.navigateTo({ url: "/pages/model-contest/model-contest" });
          break;
        case "orders":
          wx.navigateTo({ url: "/pages/business-showcase/business-showcase" });
          break;
        default:
          wx.showToast({ title: "开发中，敬请期待", icon: "none" });
      }
    },

    goEntryPage(e) {
      const url = e.currentTarget.dataset.url || "";
      if (!url) return;
      wx.navigateTo({ url });
    }
  }
});
