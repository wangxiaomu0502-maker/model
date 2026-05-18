Page({
  data: {
    tabs: [
      { key: "main", label: "模特类型" },
      { key: "style", label: "风格" },
      { key: "scene", label: "场景" }
    ],
    currentTab: "main",
    mainTypeGroups: [],
    styleGroups: [],
    sceneGroups: [],
    majorGroups: [],
    activeMajorGroup: null,
    activeMainGroupId: 0,
    activeStyleGroupId: 0,
    activeSceneGroupId: 0,
    selectedCategoryIds: [],
    selectedMap: {},
    selectedCount: 0
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

  getGroupsByTab(tab) {
    if (tab === "style") return this.data.styleGroups || [];
    if (tab === "scene") return this.data.sceneGroups || [];
    return this.data.mainTypeGroups || [];
  },

  getActiveGroupIdByTab(tab) {
    if (tab === "style") return this.data.activeStyleGroupId;
    if (tab === "scene") return this.data.activeSceneGroupId;
    return this.data.activeMainGroupId;
  },

  pickActiveGroup(groups, activeId) {
    if (!groups.length) return null;
    const hit = groups.find((g) => g.id === activeId);
    return hit || groups[0];
  },

  syncMajorPanel(tab) {
    const groups = this.getGroupsByTab(tab);
    const activeId = this.getActiveGroupIdByTab(tab);
    const active = this.pickActiveGroup(groups, activeId);
    const patch = {
      majorGroups: groups,
      activeMajorGroup: active
    };
    if (tab === "main") patch.activeMainGroupId = active?.id || 0;
    if (tab === "style") patch.activeStyleGroupId = active?.id || 0;
    if (tab === "scene") patch.activeSceneGroupId = active?.id || 0;
    return patch;
  },

  async onLoad() {
    try {
      const treeResp = await this.requestWithAuth("/api/models/category-tree", "GET");
      if (treeResp?.ok && treeResp?.tree) {
        const mainTypeGroups = treeResp.tree.mainTypeGroups || [];
        const styleGroups = treeResp.tree.styleGroups || [];
        const sceneGroups = treeResp.tree.sceneGroups || [];
        this.setData({
          mainTypeGroups,
          styleGroups,
          sceneGroups,
          activeMainGroupId: mainTypeGroups[0]?.id || 0,
          activeStyleGroupId: styleGroups[0]?.id || 0,
          activeSceneGroupId: sceneGroups[0]?.id || 0
        });
        this.setData(this.syncMajorPanel("main"));
      }
      const categoryResp = await this.requestWithAuth("/api/models/categories", "GET");
      if (!categoryResp?.ok) return;
      const selectedCategoryIds = categoryResp.categoryIds || [];
      this.setData({
        selectedCategoryIds,
        selectedMap: this.toMap(selectedCategoryIds),
        selectedCount: selectedCategoryIds.length
      });
    } catch (_error) {}
  },

  toMap(list) {
    const map = {};
    (list || []).forEach((item) => {
      map[item] = true;
    });
    return map;
  },

  toggleSelect(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    if (!value) return;
    const current = this.data.selectedCategoryIds || [];
    const exists = current.includes(value);
    const next = exists ? current.filter((item) => item !== value) : [...current, value];
    this.setData({
      selectedCategoryIds: next,
      selectedMap: this.toMap(next),
      selectedCount: next.length
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.currentTab) return;
    const patch = this.syncMajorPanel(tab);
    patch.currentTab = tab;
    this.setData(patch);
  },

  switchMajorGroup(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (!id) return;
    const tab = this.data.currentTab;
    const groups = this.getGroupsByTab(tab);
    const active = this.pickActiveGroup(groups, id);
    const patch = { activeMajorGroup: active };
    if (tab === "main") patch.activeMainGroupId = id;
    if (tab === "style") patch.activeStyleGroupId = id;
    if (tab === "scene") patch.activeSceneGroupId = id;
    this.setData(patch);
  },

  async saveSelection() {
    if (!this.data.selectedCategoryIds.length) {
      wx.showToast({ title: "请至少选择1个分类", icon: "none" });
      return;
    }

    const payload = {
      categoryIds: this.data.selectedCategoryIds
    };
    try {
      const data = await this.requestWithAuth("/api/models/categories", "PUT", payload);
      if (!data?.ok) {
        wx.showToast({ title: data?.message || "保存失败", icon: "none" });
        return;
      }
      wx.showToast({ title: "已保存", icon: "success", duration: 1500 });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.switchTab({ url: "/pages/mine/mine" });
        }
      }, 1600);
    } catch (_error) {
      wx.showToast({ title: "网络异常", icon: "none" });
    }
  }
});
