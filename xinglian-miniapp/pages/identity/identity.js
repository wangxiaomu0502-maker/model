const PLATFORM_BIND_FAIL_TEXT = "平台暂未帮您绑定账号，请联系管理员";
const { homeTabUrlForRole } = require("../../utils/role-tab.js");

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
        name: "客户",
        role: 2,
        icon: "客",
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
    currentRole: 0,
    showModelModal: false,
    platformBindError: "",
    platformBindLoading: false
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

    if (role === 1) {
      this.setData({
        currentIdentity: identity,
        currentRole: role
      });
      return;
    }

    this.setData({
      currentIdentity: identity,
      currentRole: role,
      showModelModal: false,
      modelModalStep: "choose",
      platformBindError: ""
    });
  },

  closeModelModal() {
    this.setData({
      showModelModal: false,
      platformBindLoading: false,
      platformBindError: ""
    });
  },

  openPlatformBindModal() {
    this.setData({
      showModelModal: true,
      platformBindError: ""
    });
  },

  preventModalBubble() {},

  onModelPlatformBind() {
    this.openPlatformBindModal();
  },

  getIdentityByRole(role) {
    const map = {
      0: "游客",
      1: "模特",
      2: "客户",
      3: "经纪人",
      4: "代理人",
      5: "管理员"
    };
    return map[Number(role)] || "游客";
  },

  enterHomeByRole(role) {
    const targetUrl = homeTabUrlForRole(role) || "/pages/home-intro/home-intro";

    if (targetUrl === "/pages/home-intro/home-intro") {
      wx.reLaunch({ url: targetUrl });
      return;
    }
    wx.switchTab({ url: targetUrl });
  },

  applyLoginResult(payload) {
    const app = getApp();
    const user = payload.user || {};
    const role = Number(user.role || 1);
    app.globalData.openId = user.openid || app.globalData.openId;
    app.globalData.userId = user.id;
    app.globalData.userNo = user.userNo || "";
    app.globalData.role = role;
    app.globalData.identity = this.getIdentityByRole(role);
    if (payload.token) {
      app.globalData.token = payload.token;
      wx.setStorageSync("authToken", payload.token);
    }
    wx.setStorageSync("selectedRole", role);
  },

  onPlatformBindGetPhone(e) {
    const detail = e.detail || {};
    if (!detail.code) {
      wx.showToast({
        title: "手机号授权未完成",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新打开小程序",
        icon: "none"
      });
      return;
    }

    this.setData({
      platformBindLoading: true,
      platformBindError: ""
    });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/auth/model/platform-bind`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${app.globalData.token}`
      },
      data: {
        code: detail.code
      },
      success: (res) => {
        const data = res.data || {};
        if (!data.ok || !data.user) {
          const msg = data.message || PLATFORM_BIND_FAIL_TEXT;
          this.setData({ platformBindError: msg });
          wx.showToast({ title: msg, icon: "none", duration: 2800 });
          return;
        }

        this.applyLoginResult(data);
        this.setData({
          showModelModal: false,
          platformBindError: ""
        });
        const verifiedStatus = Number(data.user.verifiedStatus ?? 0);
        if (verifiedStatus !== 2) {
          wx.showToast({
            title: "绑定成功，请完成实名认证",
            icon: "none",
            duration: 2800
          });
          setTimeout(() => {
            wx.navigateTo({ url: "/pages/realname-verify/realname-verify?mode=bound" });
          }, 500);
          return;
        }
        wx.showToast({
          title: "绑定成功",
          icon: "success"
        });
        setTimeout(() => {
          this.enterHomeByRole(data.user.role);
        }, 500);
      },
      fail: () => {
        const msg = "网络异常，请稍后重试";
        this.setData({ platformBindError: msg });
        wx.showToast({ title: msg, icon: "none" });
      },
      complete: () => {
        this.setData({ platformBindLoading: false });
      }
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

    if (Number(currentRole) === 1) {
      const app = getApp();
      app.globalData.role = 1;
      app.globalData.identity = currentIdentity;
      wx.setStorageSync("selectedRole", 1);
      wx.navigateTo({
        url: "/pages/realname-verify/realname-verify"
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
