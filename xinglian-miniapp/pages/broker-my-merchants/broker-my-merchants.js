const boundListBehavior = require("../../behaviors/broker-bound-list.js");

Page({
  behaviors: [boundListBehavior],

  data: {
    pageTitle: "我的商家",
    emptyHint: "暂无绑定商家。请分享「我的二维码」，商家注册并填写您的用户 ID 后即可出现在此列表。"
  },

  getListApiPath() {
    return "/api/broker/my-merchants";
  },

  onShow() {
    if (!this.ensureBrokerRole()) return;
    this.setData({ page: 1, list: [] }, () => this.fetchPage(true));
  }
});
