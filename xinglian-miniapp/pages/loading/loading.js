const { savePendingBrokerUserNo } = require("../../utils/broker-promo.js");
const { homeTabUrlForRole } = require("../../utils/role-tab.js");

Page({
  getIdentityByRole(role) {
    const map = {
      0: "游客",
      1: "模特",
      2: "商家",
      3: "经纪人",
      4: "代理人",
      5: "管理员"
    };
    return map[Number(role)] || "游客";
  },

  data: {
    text: "正在登录..."
  },

  requestLogin(code) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/wechat/login`,
        method: "POST",
        header: {
          "content-type": "application/json"
        },
        data: {
          code
        },
        success: (res) => resolve(res.data),
        fail: (err) => reject(err)
      });
    });
  },

  onLoad(options) {
    const raw = options && options.brokerUserNo != null ? String(options.brokerUserNo) : "";
    if (raw) {
      try {
        savePendingBrokerUserNo(decodeURIComponent(raw.trim()));
      } catch (_e) {
        savePendingBrokerUserNo(raw.trim());
      }
    }
    wx.login({
      success: async (res) => {
        if (res.code) {
          try {
            const app = getApp();
            const responseData = await this.requestLogin(res.code);
            if (!responseData.ok || !responseData.user) {
              throw new Error(responseData.message || "登录接口返回异常");
            }

            app.globalData.openId = responseData.user.openid;
            app.globalData.userId = responseData.user.id;
            app.globalData.userNo = responseData.user.userNo || "";
            app.globalData.role = Number(responseData.user.role || 0);
            app.globalData.token = responseData.token || "";
            app.globalData.identity = this.getIdentityByRole(app.globalData.role);
            if (responseData.token) {
              wx.setStorageSync("authToken", responseData.token);
            }
            wx.setStorageSync("selectedRole", app.globalData.role);

            this.setData({
              text: "登录成功，正在进入小程序..."
            });

            const role = Number(responseData.user.role || 0);
            const targetUrl = homeTabUrlForRole(role) || "/pages/model-intro/model-intro";

            setTimeout(() => {
              if (targetUrl !== "/pages/model-intro/model-intro") {
                wx.switchTab({ url: targetUrl });
                return;
              }
              wx.reLaunch({ url: targetUrl });
            }, 800);
          } catch (error) {
            this.setData({
              text: `登录失败：${error.message || "请稍后重试"}`
            });
          }
        } else {
          this.setData({
            text: "登录失败，请重试"
          });
        }
      },
      fail: () => {
        this.setData({
          text: "登录失败，请检查网络"
        });
      }
    });
  }
});
