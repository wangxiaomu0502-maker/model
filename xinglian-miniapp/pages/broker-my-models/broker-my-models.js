const boundListBehavior = require("../../behaviors/broker-bound-list.js");

Page({
  behaviors: [boundListBehavior],

  data: {
    pageTitle: "我的模特",
    emptyHint: "暂无绑定模特。请分享「我的二维码」，模特注册并填写您的用户 ID 后即可出现在此列表。"
  },

  getListApiPath() {
    return "/api/broker/my-models";
  },

  onShow() {
    if (!this.ensureBrokerRole()) return;
    this.setData({ page: 1, list: [] }, () => this.fetchPage(true));
  },

  onModelCardTap(e) {
    const userNo = e.currentTarget.dataset.userNo;
    const audit = Number(e.currentTarget.dataset.audit || 0);
    if (!userNo) return;
    if (audit !== 2) {
      wx.showToast({ title: "该模特资料尚未通过审核", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  }
});
