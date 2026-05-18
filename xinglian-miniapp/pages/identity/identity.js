Page({
  data: {
    identityList: [
      {
        key: "model",
        name: "模特",
        role: 1,
        icon: "模",
        desc: "展示资料并接单合作",
        disabled: false
      },
      {
        key: "merchant",
        name: "商家",
        role: 2,
        icon: "商",
        desc: "浏览模特并直接下单",
        disabled: false
      },
      {
        key: "agent",
        name: "经纪人",
        role: 3,
        icon: "经",
        desc: "管理模特资源并撮合合作",
        disabled: false
      },
      {
        key: "super-agent",
        name: "代理人",
        role: 4,
        icon: "代",
        desc: "仅后台开通，不支持自主注册",
        disabled: true,
        tag: "仅后台开通"
      }
    ],
    currentIdentity: "",
    currentRole: 0
  },

  onLoad() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    const matched = this.data.identityList.find((item) => item.role === role && !item.disabled);
    this.setData({
      currentIdentity: matched ? matched.name : "",
      currentRole: matched ? role : 0
    });
  },

  selectIdentity(e) {
    const identity = e.currentTarget.dataset.identity;
    const disabled = Boolean(e.currentTarget.dataset.disabled);
    if (!identity || disabled) return;
    const role = Number(e.currentTarget.dataset.role || 0);
    this.setData({
      currentIdentity: identity,
      currentRole: role
    });
  },

  confirmIdentity() {
    const { currentIdentity, currentRole } = this.data;
    if (!currentIdentity || ![1, 2, 3].includes(Number(currentRole))) {
      wx.showToast({
        title: "注册后请选择正式身份",
        icon: "none"
      });
      return;
    }
    const app = getApp();
    app.globalData.role = Number(currentRole);
    app.globalData.identity = currentIdentity;
    wx.setStorageSync("selectedRole", Number(currentRole));
    wx.navigateTo({
      url: "/pages/realname-verify/realname-verify"
    });
  }
});
