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
    loadError: ""
  },

  onShow() {
    updateTabBar();
    this.ensureCategoryTreeLoaded();
    this.loadModelList(this.data.filterState, true);
  },

  preventTouchMove() {},

  onModelListModeChange(e) {
    const mode = e.currentTarget.dataset.mode || "";
    if (mode !== "list" && mode !== "large") return;
    this.setData({ modelListMode: mode });
  },

  loadModelList(filterState = this.data.filterState, preserveOptions = true) {
    const app = getApp();
    const currentOptions = this.data.filterOptions || buildModelFilterOptions([]);
    const hasFilterOptions =
      currentOptions.cities.length > 1 || currentOptions.genders.length > 1;
    const filterOptions = preserveOptions && hasFilterOptions ? currentOptions : null;
    const query = buildModelFilterQuery(filterOptions, filterState);
    this.setData({ loading: true, loadError: "" });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list${query}`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({ modelList: [], loadError: body.message || "模特列表加载失败" });
          return;
        }
        const modelList = normalizeModelList(body.list);
        const nextFilterState = {
          ...defaultModelFilterState(),
          ...(filterState || {})
        };
        const filterPatch = buildFilterPatch(modelList, nextFilterState, filterOptions);
        if (filterPatch.filteredModelList.length === 0 && filterPatch.activeFilterCount > 0) {
          filterPatch.filterExpanded = true;
        }
        this.setData({
          modelList,
          ...filterPatch,
          loadError: ""
        });
        this.syncCategoryFilterText(nextFilterState);
      },
      fail: () => {
        this.setData({ modelList: [], loadError: "网络异常，模特列表加载失败" });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
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
