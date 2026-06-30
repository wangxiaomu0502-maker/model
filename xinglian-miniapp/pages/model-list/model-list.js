const { updateTabBar } = require("../../utils/tab-bar.js");
const {
  normalizeModelList,
  buildModelFilterOptions,
  defaultModelFilterState,
  buildRegionColumns,
  getSelectedRegion,
  updateRegionColumnsByColumnChange,
  applyModelFilters,
  countActiveModelFilters,
  buildModelFilterQuery
} = require("../../utils/model-list-display.js");
const categoryFilterBehavior = require("../../behaviors/model-category-filter.js");
const {
  calcHomeScrollShieldThreshold,
  bindHomePageScroll,
  refreshHomeScrollShield
} = require("../../utils/home-page-scroll.js");
const {
  consumeModelListFromHomeIntro,
  backToHomeIntro
} = require("../../utils/model-list-navigation.js");

const MODEL_LIST_PAGE_SIZE = 20;

function buildFilterPatch(modelList, filterState, filterOptions) {
  const baseOptions = buildModelFilterOptions(modelList);
  const nextFilterState = {
    ...defaultModelFilterState(),
    ...(filterState || {})
  };
  const nextFilterOptions = {
    ...baseOptions,
    ...(filterOptions || {}),
    levels: baseOptions.levels,
    regionColumns: buildRegionColumns(nextFilterState.regionIndex)
  };
  return {
    filterOptions: nextFilterOptions,
    filterState: nextFilterState,
    regionFilterText: getSelectedRegion(nextFilterState).text,
    filteredModelList: applyModelFilters(modelList, nextFilterOptions, nextFilterState),
    activeFilterCount: countActiveModelFilters(nextFilterState)
  };
}

Page({
  behaviors: [categoryFilterBehavior],

  data: {
    modelList: [],
    filteredModelList: [],
    modelListMode: "list",
    filterOptions: buildModelFilterOptions([]),
    filterState: defaultModelFilterState(),
    regionFilterText: "全部地域",
    activeFilterCount: 0,
    filterExpanded: false,
    loading: false,
    loadingMore: false,
    hasMore: false,
    loadError: "",
    showRegisterBar: false,
    statusBarHeight: 20,
    navBarHeight: 88,
    navRowHeight: 44,
    navPaddingTop: 20,
    homeScrolled: false,
    homeScrollShieldThreshold: 12,
    showNavBack: false
  },

  onLoad() {
    this.initModelListLayoutMetrics();
  },

  onPageScroll(e) {
    bindHomePageScroll(this, e);
  },

  initModelListLayoutMetrics() {
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

  refreshNavBack() {
    if (consumeModelListFromHomeIntro()) {
      this._fromHomeIntro = true;
    }
    this.setData({ showNavBack: Boolean(this._fromHomeIntro) });
  },

  goBackToHomeIntro() {
    this._fromHomeIntro = false;
    this.setData({ showNavBack: false });
    backToHomeIntro();
  },

  onShow() {
    this.refreshNavBack();
    this.refreshRegisterBar();
    updateTabBar();
    const app = getApp();
    const pending = app.globalData.pendingModelListFilter;
    let filterState = this.data.filterState;
    if (pending && pending.resetAll && pending.ts && Date.now() - pending.ts < 60000) {
      app.globalData.pendingModelListFilter = null;
      filterState = defaultModelFilterState();
      this.setData({
        filterState,
        categoryFilterText: "全部类型"
      });
    } else if (pending && pending.ts && Date.now() - pending.ts < 60000) {
      app.globalData.pendingModelListFilter = null;
      filterState = {
        ...defaultModelFilterState(),
        categoryIds: pending.categoryIds || [],
        categoryKeyword: pending.categoryKeyword || "",
        categoryLabel: pending.categoryLabel || "",
        levelIndex: pending.levelIndex || 0
      };
      this.setData({
        filterState,
        categoryFilterText: pending.categoryLabel || this.data.categoryFilterText
      });
    }
    this.ensureCategoryTreeLoaded();
    this.loadModelList(filterState, !(pending && pending.resetAll));
    wx.nextTick(() => refreshHomeScrollShield(this));
  },

  refreshRegisterBar() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    const showRegisterBar = !app.globalData.token || role === 0;
    this.setData({ showRegisterBar });
  },

  goRegister() {
    wx.navigateTo({ url: "/pages/intro/intro" });
  },

  preventTouchMove() {},

  onModelListModeChange(e) {
    const mode = e.currentTarget.dataset.mode || "";
    if (mode !== "list" && mode !== "large") return;
    this.setData({ modelListMode: mode });
  },

  loadModelList(filterState = this.data.filterState, preserveOptions = true, options = {}) {
    const append = Boolean(options && options.append);
    const app = getApp();
    const currentOptions = this.data.filterOptions || buildModelFilterOptions([]);
    const hasFilterOptions =
      currentOptions.cities.length > 1 || currentOptions.genders.length > 1;
    const filterOptions = preserveOptions && hasFilterOptions ? currentOptions : null;
    const nextFilterState = {
      ...defaultModelFilterState(),
      ...(filterState || {})
    };
    const offset = append ? (this.data.filteredModelList || []).length : 0;
    const query = buildModelFilterQuery(filterOptions, nextFilterState, {
      limit: MODEL_LIST_PAGE_SIZE,
      offset
    });

    if (append) {
      if (this.data.loadingMore || !this.data.hasMore || this.data.loading) return;
      this.setData({ loadingMore: true });
    } else {
      this.setData({ loading: true, loadError: "", hasMore: false, loadingMore: false });
    }

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list${query}`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          if (!append) {
            this.setData({ modelList: [], filteredModelList: [], loadError: body.message || "模特列表加载失败" });
          }
          return;
        }
        const batch = normalizeModelList(body.list);
        const modelList = append ? (this.data.modelList || []).concat(batch) : batch;
        const filterPatch = buildFilterPatch(modelList, nextFilterState, filterOptions);
        filterPatch.filteredModelList = modelList;
        filterPatch.hasMore = batch.length >= MODEL_LIST_PAGE_SIZE;
        if (filterPatch.filteredModelList.length === 0 && filterPatch.activeFilterCount > 0) {
          filterPatch.filterExpanded = true;
        }
        this.setData({
          modelList,
          ...filterPatch,
          loadError: ""
        });
        if (nextFilterState.categoryLabel) {
          this.setData({ categoryFilterText: nextFilterState.categoryLabel });
        } else {
          this.syncCategoryFilterText(nextFilterState);
        }
      },
      fail: () => {
        if (!append) {
          this.setData({ modelList: [], filteredModelList: [], loadError: "网络异常，模特列表加载失败" });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  onReachBottom() {
    this.loadModelList(this.data.filterState, true, { append: true });
  },

  goEntryPage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    wx.navigateTo({ url });
  },

  onFilterChange(e) {
    const key = e.currentTarget.dataset.key || "";
    const value = Number(e.detail.value || 0);
    if (!key) return;
    const filterState = {
      ...this.data.filterState,
      [`${key}Index`]: value
    };
    this.loadModelList(filterState, true);
  },

  onRegionColumnChange(e) {
    const detail = e.detail || {};
    const patch = updateRegionColumnsByColumnChange(
      this.data.filterState.regionIndex,
      detail.column,
      detail.value
    );
    this.setData({
      "filterState.regionIndex": patch.regionIndex,
      "filterOptions.regionColumns": patch.regionColumns,
      regionFilterText: getSelectedRegion({ regionIndex: patch.regionIndex }).text
    });
  },

  onRegionChange(e) {
    const filterState = {
      ...this.data.filterState,
      regionIndex: e.detail.value || [0, 0]
    };
    this.loadModelList(filterState, true);
  },

  resetFilters() {
    this.loadModelList(defaultModelFilterState(), false);
  },

  toggleFilterExpanded() {
    this.setData({ filterExpanded: !this.data.filterExpanded });
  },

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  }
});
