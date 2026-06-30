const { normalizeModelList } = require("./model-list-display.js");

const HOME_FEATURED_PAGE_SIZE = 20;

function featuredModelsDataDefaults() {
  return {
    featuredModels: [],
    featuredHasMore: false,
    featuredLoadingMore: false
  };
}

function buildFeaturedListQuery(offset) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  return `?limit=${HOME_FEATURED_PAGE_SIZE}&offset=${safeOffset}`;
}

function requestFeaturedModelsPage(page, { offset, append }) {
  const app = getApp();
  const loadingMore = Boolean(append);

  if (loadingMore) {
    page.setData({ featuredLoadingMore: true });
  }

  wx.request({
    url: `${app.globalData.apiBaseUrl}/api/models/list${buildFeaturedListQuery(offset)}`,
    method: "GET",
    header: {
      Authorization: `Bearer ${app.globalData.token || ""}`
    },
    success: (res) => {
      const body = res.data || {};
      if (res.statusCode !== 200 || !body.ok) {
        if (!append) {
          page.setData({
            ...featuredModelsDataDefaults(),
            loadError: body.message || "首页内容加载失败"
          });
        }
        return;
      }

      const batch = normalizeModelList(body.list);
      const featuredModels = append ? (page.data.featuredModels || []).concat(batch) : batch;
      page.setData({
        featuredModels,
        featuredHasMore: batch.length >= HOME_FEATURED_PAGE_SIZE,
        featuredLoadingMore: false,
        loadError: ""
      });
    },
    fail: () => {
      if (!append) {
        page.setData({
          ...featuredModelsDataDefaults(),
          loadError: "网络异常，首页内容加载失败"
        });
      } else {
        page.setData({ featuredLoadingMore: false });
      }
    },
    complete: () => {
      if (!append) {
        page.setData({ loading: false });
      } else {
        page.setData({ featuredLoadingMore: false });
      }
    }
  });
}

function loadHomeFeaturedModels(page) {
  page.setData(featuredModelsDataDefaults());
  requestFeaturedModelsPage(page, { offset: 0, append: false });
}

function loadMoreHomeFeaturedModels(page) {
  const { featuredLoadingMore, featuredHasMore, loading } = page.data;
  if (featuredLoadingMore || !featuredHasMore || loading) return;
  requestFeaturedModelsPage(page, {
    offset: (page.data.featuredModels || []).length,
    append: true
  });
}

module.exports = {
  HOME_FEATURED_PAGE_SIZE,
  featuredModelsDataDefaults,
  loadHomeFeaturedModels,
  loadMoreHomeFeaturedModels
};
