const incomeLedger = require("../../behaviors/income-ledger");

Page({
  behaviors: [incomeLedger],

  onLoad() {
    this.fetchWallet({ append: false });
  },

  onPullDownRefresh() {
    this.fetchWallet({ append: false }).then(() => wx.stopPullDownRefresh());
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "收入明细" });
  }
});
