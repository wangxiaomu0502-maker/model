const CATEGORY_TABS = [
  { key: "main", label: "模特类型" },
  { key: "style", label: "风格" },
  { key: "scene", label: "场景" }
];

function flattenCategoryTree(groups) {
  const result = [];
  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      if (!node || !node.id) return;
      result.push({ id: Number(node.id), name: node.name || "" });
      if (node.children && node.children.length) walk(node.children);
    });
  };
  walk(groups);
  return result;
}

function buildCategoryNameMap(tree) {
  const map = {};
  if (!tree) return map;
  const all = flattenCategoryTree([
    ...(tree.mainTypeGroups || []),
    ...(tree.styleGroups || []),
    ...(tree.sceneGroups || [])
  ]);
  all.forEach((item) => {
    map[item.id] = item.name;
  });
  return map;
}

function getGroupsByTab(tab, data) {
  if (tab === "style") return data.styleGroups || [];
  if (tab === "scene") return data.sceneGroups || [];
  return data.mainTypeGroups || [];
}

function getActiveGroupIdByTab(tab, data) {
  if (tab === "style") return data.activeStyleGroupId;
  if (tab === "scene") return data.activeSceneGroupId;
  return data.activeMainGroupId;
}

function pickActiveGroup(groups, activeId) {
  if (!groups.length) return null;
  const hit = groups.find((g) => g.id === activeId);
  return hit || groups[0];
}

function syncMajorPanel(tab, data) {
  const groups = getGroupsByTab(tab, data);
  const activeId = getActiveGroupIdByTab(tab, data);
  const active = pickActiveGroup(groups, activeId);
  const patch = {
    majorGroups: groups,
    activeMajorGroup: active
  };
  if (tab === "main") patch.activeMainGroupId = active?.id || 0;
  if (tab === "style") patch.activeStyleGroupId = active?.id || 0;
  if (tab === "scene") patch.activeSceneGroupId = active?.id || 0;
  return patch;
}

function toSelectedMap(ids) {
  const map = {};
  (ids || []).forEach((id) => {
    map[id] = true;
  });
  return map;
}

function buildSelectedOptions(ids, nameMap) {
  return (ids || []).map((id) => ({
    id,
    name: (nameMap && nameMap[id]) || `分类${id}`
  }));
}

function formatCategoryFilterLabel(ids, nameMap) {
  const list = Array.isArray(ids) ? ids.filter((id) => Number(id) > 0) : [];
  if (!list.length) return "全部类型";
  if (list.length === 1) {
    const name = nameMap && nameMap[list[0]];
    return name || "已选 1 项";
  }
  return `已选 ${list.length} 项`;
}

function defaultCategoryFilterPopupState() {
  return {
    categoryFilterPopupVisible: false,
    categoryTreeLoaded: false,
    categoryTreeLoading: false,
    categoryTabs: CATEGORY_TABS,
    categoryCurrentTab: "main",
    mainTypeGroups: [],
    styleGroups: [],
    sceneGroups: [],
    categoryNameMap: {},
    majorGroups: [],
    activeMajorGroup: null,
    activeMainGroupId: 0,
    activeStyleGroupId: 0,
    activeSceneGroupId: 0,
    draftCategoryIds: [],
    draftSelectedMap: {},
    draftSelectedCount: 0,
    draftSelectedOptions: []
  };
}

module.exports = {
  CATEGORY_TABS,
  flattenCategoryTree,
  buildCategoryNameMap,
  getGroupsByTab,
  syncMajorPanel,
  toSelectedMap,
  buildSelectedOptions,
  formatCategoryFilterLabel,
  defaultCategoryFilterPopupState
};
