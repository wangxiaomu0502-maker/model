function avatarText(nickname) {
  const text = String(nickname || "").trim();
  return text ? text.slice(0, 1) : "?";
}

function normalizeSearchItem(item) {
  const avatarUrl = String(item.avatarUrl || "").trim();
  return {
    type: item.type,
    typeLabel: item.typeLabel || "",
    userNo: item.userNo,
    nickname: item.nickname || "未命名",
    avatarUrl,
    showAvatarImg: !!avatarUrl,
    avatarText: avatarText(item.nickname),
    subtitle: item.subtitle || item.city || ""
  };
}

Page({
  data: {
    searchDraft: "",
    keyword: "",
    list: [],
    loading: false,
    loadError: "",
    inputFocus: false
  },

  onLoad(options) {
    const keyword = decodeURIComponent(options.keyword || "").trim();
    const patch = { searchDraft: keyword };
    if (keyword) {
      patch.keyword = keyword;
    } else {
      patch.inputFocus = true;
    }
    this.setData(patch, () => {
      if (keyword) this.runSearch(keyword);
    });
  },

  onSearchInput(e) {
    this.setData({ searchDraft: e.detail.value || "" });
  },

  onSearchConfirm() {
    const keyword = String(this.data.searchDraft || "").trim();
    if (!keyword) {
      wx.showToast({ title: "请输入搜索内容", icon: "none" });
      return;
    }
    this.setData({ keyword }, () => this.runSearch(keyword));
  },

  onClearSearch() {
    this.setData({
      searchDraft: "",
      keyword: "",
      list: [],
      loadError: "",
      inputFocus: true
    });
  },

  runSearch(keyword) {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/search/users`,
      method: "GET",
      data: { keyword, limit: 30 },
      header: {
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({ list: [], loadError: body.message || "搜索失败" });
          return;
        }
        const list = (body.list || []).map(normalizeSearchItem);
        this.setData({ list, loadError: "" });
      },
      fail: () => {
        this.setData({ list: [], loadError: "网络异常，请稍后重试" });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  onItemTap(e) {
    const type = e.currentTarget.dataset.type || "";
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    if (type === "model") {
      wx.navigateTo({
        url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
      });
      return;
    }
    if (type === "broker") {
      wx.navigateTo({
        url: `/pages/broker-detail/broker-detail?userNo=${encodeURIComponent(userNo)}`
      });
      return;
    }
    if (type === "merchant") {
      wx.navigateTo({
        url: `/pages/merchant-detail/merchant-detail?userNo=${encodeURIComponent(userNo)}`
      });
    }
  }
});
