const {
  buildCategoryNameMap,
  syncMajorPanel,
  toSelectedMap,
  buildSelectedOptions,
  formatCategoryFilterLabel,
  defaultCategoryFilterPopupState
} = require("../utils/model-category-tree.js");
const { normalizeCategoryIds } = require("../utils/model-list-display.js");

module.exports = Behavior({
  data: {
    categoryFilterText: "全部类型",
    appliedCategoryOptions: [],
    ...defaultCategoryFilterPopupState()
  },

  methods: {
    ensureCategoryTreeLoaded() {
      if (this.data.categoryTreeLoaded || this.data.categoryTreeLoading) {
        return Promise.resolve(Boolean(this.data.categoryTreeLoaded));
      }
      const app = getApp();
      this.setData({ categoryTreeLoading: true });
      return new Promise((resolve) => {
        wx.request({
          url: `${app.globalData.apiBaseUrl}/api/models/category-tree`,
          method: "GET",
          header: {
            Authorization: `Bearer ${app.globalData.token || ""}`
          },
          success: (res) => {
            const body = res.data || {};
            if (res.statusCode !== 200 || !body.ok || !body.tree) {
              resolve(false);
              return;
            }
            const tree = body.tree;
            const mainTypeGroups = tree.mainTypeGroups || [];
            const styleGroups = tree.styleGroups || [];
            const sceneGroups = tree.sceneGroups || [];
            const categoryNameMap = buildCategoryNameMap(tree);
            const patch = {
              mainTypeGroups,
              styleGroups,
              sceneGroups,
              categoryNameMap,
              categoryTreeLoaded: true,
              activeMainGroupId: mainTypeGroups[0]?.id || 0,
              activeStyleGroupId: styleGroups[0]?.id || 0,
              activeSceneGroupId: sceneGroups[0]?.id || 0,
              categoryCurrentTab: "main"
            };
            this.setData({
              ...patch,
              ...syncMajorPanel("main", patch)
            });
            this.syncCategoryFilterText();
            resolve(true);
          },
          fail: () => resolve(false),
          complete: () => {
            this.setData({ categoryTreeLoading: false });
          }
        });
      });
    },

    syncCategoryFilterText(filterState) {
      const state = filterState || this.data.filterState || {};
      const ids = normalizeCategoryIds(state.categoryIds);
      const nameMap = this.data.categoryNameMap || {};
      const text = formatCategoryFilterLabel(ids, nameMap);
      this.setData({
        categoryFilterText: text,
        appliedCategoryOptions: buildSelectedOptions(ids, nameMap)
      });
    },

    syncDraftCategorySelection(ids) {
      const draftCategoryIds = normalizeCategoryIds(ids);
      this.setData({
        draftCategoryIds,
        draftSelectedMap: toSelectedMap(draftCategoryIds),
        draftSelectedCount: draftCategoryIds.length,
        draftSelectedOptions: buildSelectedOptions(draftCategoryIds, this.data.categoryNameMap || {})
      });
    },

    async openCategoryFilterPopup() {
      const loaded = await this.ensureCategoryTreeLoaded();
      if (!loaded) {
        wx.showToast({ title: "分类加载失败", icon: "none" });
        return;
      }
      const ids = normalizeCategoryIds((this.data.filterState || {}).categoryIds);
      this.syncDraftCategorySelection(ids);
      this.setData({ categoryFilterPopupVisible: true });
    },

    closeCategoryFilterPopup() {
      this.setData({ categoryFilterPopupVisible: false });
    },

    onCategoryFilterMaskTap() {
      this.closeCategoryFilterPopup();
    },

    preventCategoryFilterBubble() {},

    onCategoryFilterTabTap(e) {
      const tab = e.currentTarget.dataset.tab || "";
      if (!tab || tab === this.data.categoryCurrentTab) return;
      const patch = syncMajorPanel(tab, this.data);
      patch.categoryCurrentTab = tab;
      this.setData(patch);
    },

    onCategoryFilterMajorTap(e) {
      const id = Number(e.currentTarget.dataset.id || 0);
      if (!id) return;
      const tab = this.data.categoryCurrentTab;
      const groups =
        tab === "style"
          ? this.data.styleGroups
          : tab === "scene"
            ? this.data.sceneGroups
            : this.data.mainTypeGroups;
      const active = (groups || []).find((g) => g.id === id) || groups[0] || null;
      const patch = { activeMajorGroup: active };
      if (tab === "main") patch.activeMainGroupId = id;
      if (tab === "style") patch.activeStyleGroupId = id;
      if (tab === "scene") patch.activeSceneGroupId = id;
      this.setData(patch);
    },

    onCategoryFilterChipTap(e) {
      const value = Number(e.currentTarget.dataset.value || 0);
      if (!value) return;
      const current = this.data.draftCategoryIds || [];
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value];
      this.syncDraftCategorySelection(next);
    },

    onCategoryFilterDraftRemove(e) {
      const value = Number(e.currentTarget.dataset.value || 0);
      if (!value) return;
      const next = (this.data.draftCategoryIds || []).filter((item) => item !== value);
      this.syncDraftCategorySelection(next);
    },

    clearDraftCategoryFilter() {
      this.syncDraftCategorySelection([]);
    },

    confirmCategoryFilter() {
      const categoryIds = normalizeCategoryIds(this.data.draftCategoryIds);
      const filterState = {
        ...(this.data.filterState || {}),
        categoryIds
      };
      this.closeCategoryFilterPopup();
      this.syncCategoryFilterText(filterState);
      if (typeof this.loadModelList === "function") {
        this.loadModelList(filterState, true);
      }
    }
  }
});
