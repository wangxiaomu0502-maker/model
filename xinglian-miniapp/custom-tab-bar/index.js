Component({
  data: {
    selected: 0,
    list: []
  },

  lifetimes: {
    attached() {
      const { hideNativeTabBar } = require("../utils/tab-bar.js");
      hideNativeTabBar();
      this.refresh();
    }
  },

  methods: {
    normalizeRoute(route) {
      return String(route || "")
        .replace(/^\//, "")
        .split("?")[0];
    },

    buildList(role) {
      const statsIcon = "/assets/tab/stats.png";
      const statsActiveIcon = "/assets/tab/stats-active.png";
      const listIcon = "/assets/tab/list.png";
      const listActiveIcon = "/assets/tab/list-active.png";
      const mineIcon = "/assets/tab/mine.png";
      const mineActiveIcon = "/assets/tab/mine-active.png";
      const modelList = {
        pagePath: "pages/model-list/model-list",
        text: "模特列表",
        iconPath: listIcon,
        selectedIconPath: listActiveIcon
      };
      const mine = {
        pagePath: "pages/mine/mine",
        text: "我的",
        iconPath: mineIcon,
        selectedIconPath: mineActiveIcon
      };
      if (role === 1) {
        return [
          {
            pagePath: "pages/model-stats/model-stats",
            text: "统计信息",
            iconPath: statsIcon,
            selectedIconPath: statsActiveIcon
          },
          modelList,
          mine
        ];
      }
      if (role === 3 || role === 4) {
        return [
          {
            pagePath: "pages/model-stats/model-stats",
            text: "统计信息",
            iconPath: statsIcon,
            selectedIconPath: statsActiveIcon
          },
          modelList,
          mine
        ];
      }
      return [modelList, mine];
    },

    indexForRoute(list, route) {
      const normalized = this.normalizeRoute(route);
      const idx = list.findIndex((item) => this.normalizeRoute(item.pagePath) === normalized);
      return idx >= 0 ? idx : 0;
    },

    refresh() {
      const app = getApp();
      const role = Number(app.globalData.role || wx.getStorageSync("selectedRole") || 0);
      const list = this.buildList(role);
      const pages = getCurrentPages();
      const route = pages.length ? pages[pages.length - 1].route : "";
      const selected = this.indexForRoute(list, route);
      this.setData({ list, selected });
    },

    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      const index = Number(e.currentTarget.dataset.index);
      if (!path) return;
      if (Number.isFinite(index) && index >= 0) {
        this.setData({ selected: index });
      }
      wx.switchTab({
        url: `/${path}`,
        success: () => {
          this.setData({ selected: index });
        }
      });
    }
  }
});
