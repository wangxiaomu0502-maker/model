function formatPrice(value) {
  const text = String(value || "").trim();
  if (!text) return "费用待补充";
  if (/^[¥￥]/.test(text)) return text;
  return `¥ ${text}`;
}

function formatRemark(value) {
  const text = String(value || "").trim();
  if (!text) {
    return { remarkText: "", remarkTags: [] };
  }
  const tags = text
    .split(/[·+、]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (tags.length >= 2) {
    return { remarkText: "", remarkTags: tags };
  }
  return { remarkText: text, remarkTags: [] };
}

function normalizePackage(item) {
  const remark = formatRemark(item.remark);
  return {
    ...item,
    nameText: item.name || "未命名套餐",
    feeText: formatPrice(item.fee),
    listPriceText: formatPrice(item.listPrice),
    remarkText: remark.remarkText,
    remarkTags: remark.remarkTags,
    coverUrl: String(item.coverUrl || "").trim()
  };
}

function normalizeItem(item) {
  const imageUrls = Array.isArray(item.imageUrls) ? item.imageUrls : [];
  const contactPhone = String(item.contactPhone || "").trim();
  const packages = (Array.isArray(item.packages) ? item.packages : []).map(normalizePackage);
  return {
    ...item,
    nameText: item.name || "未命名商拍",
    addressText: [item.province, item.city, item.district, item.detailAddress]
      .filter(Boolean)
      .join(" ") || "地址待补充",
    contactNameText: item.contactName || "联系人待补充",
    contactPhoneText: contactPhone || "联系方式待补充",
    priceRangeText: formatPrice(item.priceRange),
    descriptionText: item.description || "",
    imageUrls,
    packages,
    packageCount: packages.length,
    canCall: /^1\d{10}$/.test(contactPhone)
  };
}

Page({
  data: {
    list: [],
    total: 0,
    packageTotal: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loadingMore: false
  },

  onShow() {
    this.reloadList();
  },

  onPullDownRefresh() {
    this.reloadList(true);
  },

  onReachBottom() {
    const { list, total, loading, loadingMore } = this.data;
    if (loading || loadingMore || list.length >= total) return;
    this.setData({ page: this.data.page + 1 }, () => this.fetchVenues(false));
  },

  reloadList(fromPullDown) {
    this.setData({ page: 1, list: [], packageTotal: 0 }, () => {
      this.fetchVenues(true, fromPullDown);
    });
  },

  fetchVenues(reset, fromPullDown) {
    const app = getApp();
    const { page, pageSize, list } = this.data;
    const url = `${app.globalData.apiBaseUrl}/api/commercial-shoots?page=${page}&pageSize=${pageSize}`;
    if (reset) this.setData({ loading: true });
    else this.setData({ loadingMore: true });

    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: "GET",
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok) {
            wx.showToast({ title: body.message || "加载失败", icon: "none" });
            reject(new Error(body.message || "加载失败"));
            return;
          }
          const chunk = (Array.isArray(body.list) ? body.list : []).map(normalizeItem);
          const nextList = reset ? chunk : list.concat(chunk);
          const packageTotal = nextList.reduce(
            (sum, item) => sum + (Number(item.packageCount) || 0),
            0
          );
          this.setData({
            list: nextList,
            total: Number(body.total || 0),
            packageTotal,
            page,
            pageSize: Number(body.pageSize || pageSize)
          });
          resolve(chunk);
        },
        fail: () => {
          wx.showToast({ title: "网络异常", icon: "none" });
          reject(new Error("网络异常"));
        },
        complete: () => {
          this.setData({ loading: false, loadingMore: false });
          if (fromPullDown) wx.stopPullDownRefresh();
        }
      });
    });
  },

  onPreviewImage(e) {
    const { id, current } = e.currentTarget.dataset;
    const row = (this.data.list || []).find((item) => Number(item.id) === Number(id));
    const imageUrls = row && Array.isArray(row.imageUrls) ? row.imageUrls : [];
    if (!imageUrls.length) return;
    wx.previewImage({
      current: current || imageUrls[0],
      urls: imageUrls
    });
  },

  onPreviewPackageCover(e) {
    const url = String(e.currentTarget.dataset.url || "").trim();
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },

  onCallPhone(e) {
    const phone = String(e.currentTarget.dataset.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: "暂无有效电话", icon: "none" });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  }
});
