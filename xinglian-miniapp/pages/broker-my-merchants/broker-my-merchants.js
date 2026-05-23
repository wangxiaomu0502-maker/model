const boundListBehavior = require("../../behaviors/broker-bound-list.js");

Page({
  behaviors: [boundListBehavior],

  data: {
    pageTitle: "我的商家",
    emptyHint: "暂无绑定商家。商家注册后由平台在后台绑定经纪人，绑定后将出现在此列表。"
  },

  getListApiPath() {
    return "/api/broker/my-merchants";
  },

  onShow() {
    if (!this.ensureBrokerRole()) return;
    this.setData({ page: 1, list: [] }, () => this.fetchPage(true));
  }
});
