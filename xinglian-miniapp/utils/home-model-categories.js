/** 首页六大模特类型 → 分类树 rootIds（含子孙叶子节点用于列表筛选） */
const HOME_MODEL_CATEGORIES = [
  {
    key: "fashion",
    label: "时装模特",
    themeClass: "home-category-card--fashion",
    rootIds: [54]
  },
  {
    key: "product",
    label: "广告产品模特",
    themeClass: "home-category-card--product",
    rootIds: [100, 68]
  },
  {
    key: "film",
    label: "影视镜头模特",
    themeClass: "home-category-card--film",
    rootIds: [101, 215]
  },
  {
    key: "event",
    label: "活动礼仪模特",
    themeClass: "home-category-card--event",
    rootIds: [229, 308]
  },
  {
    key: "actor",
    label: "演员类模特",
    themeClass: "home-category-card--actor",
    rootIds: [225]
  },
  {
    key: "foreign",
    label: "外籍模特",
    themeClass: "home-category-card--foreign",
    rootIds: [],
    keyword: "外籍"
  }
];

let categoryTreePromise = null;

function isLoggedIn(app) {
  return Boolean(app.globalData.token) && Number(app.globalData.role || 0) > 0;
}

function getAllTreeGroups(tree) {
  if (!tree) return [];
  return [
    ...(tree.mainTypeGroups || []),
    ...(tree.styleGroups || []),
    ...(tree.sceneGroups || [])
  ];
}

function collectLeafIdsUnderRoots(groups, rootIds) {
  const roots = new Set((rootIds || []).map((id) => Number(id)).filter((id) => id > 0));
  if (!roots.size) return [];
  const leafIds = [];
  const walk = (node, active) => {
    if (!node || !node.id) return;
    const id = Number(node.id);
    const isRoot = roots.has(id);
    const under = active || isRoot;
    const children = Array.isArray(node.children) ? node.children : [];
    if (under && children.length === 0) leafIds.push(id);
    children.forEach((child) => walk(child, under));
  };
  (groups || []).forEach((group) => walk(group, false));
  return Array.from(new Set(leafIds));
}

function fetchCategoryTree(app) {
  if (categoryTreePromise) return categoryTreePromise;
  categoryTreePromise = new Promise((resolve) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/category-tree`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode === 200 && body.ok && body.tree) {
          resolve(body.tree);
          return;
        }
        categoryTreePromise = null;
        resolve(null);
      },
      fail: () => {
        categoryTreePromise = null;
        resolve(null);
      }
    });
  });
  return categoryTreePromise;
}

function findHomeCategory(key) {
  return HOME_MODEL_CATEGORIES.find((item) => item.key === key) || null;
}

async function resolveHomeCategoryFilter(app, item) {
  const tree = await fetchCategoryTree(app);
  const groups = getAllTreeGroups(tree);
  const categoryIds = collectLeafIdsUnderRoots(groups, item.rootIds);
  return {
    categoryIds,
    categoryKeyword: categoryIds.length ? "" : String(item.keyword || "").trim(),
    categoryLabel: item.label
  };
}

function requireLogin(app, options) {
  if (isLoggedIn(app)) return true;
  const title = (options && options.title) || "登录后继续使用";
  const content = (options && options.content) || "请先注册或登录，即可使用平台功能。";
  wx.showModal({
    title,
    content,
    confirmText: "去登录",
    cancelText: "取消",
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({ url: "/pages/intro/intro" });
      }
    }
  });
  return false;
}

async function goModelListByHomeCategory(key) {
  const app = getApp();
  const item = findHomeCategory(key);
  if (!item) return;
  if (!requireLogin(app, {
    title: "登录后查看模特",
    content: "请先注册或登录，即可按类型浏览模特列表。"
  })) return;

  wx.showLoading({ title: "加载中", mask: true });
  try {
    const filter = await resolveHomeCategoryFilter(app, item);
    app.globalData.pendingModelListFilter = {
      ...filter,
      ts: Date.now()
    };
    wx.switchTab({ url: "/pages/model-list/model-list" });
  } finally {
    wx.hideLoading();
  }
}

module.exports = {
  HOME_MODEL_CATEGORIES,
  goModelListByHomeCategory,
  collectLeafIdsUnderRoots,
  getAllTreeGroups,
  requireLogin
};
