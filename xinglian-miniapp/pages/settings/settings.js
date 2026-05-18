Page({
  data: {
    deleting: false
  },

  handleDeleteAccount() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;

    if (!token) {
      wx.showToast({
        title: "请先登录",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "确认注销",
      content: "注销后将删除当前账号数据，且无法恢复。是否继续？",
      confirmColor: "#d93025",
      success: (modalResult) => {
        if (!modalResult.confirm || this.data.deleting) {
          return;
        }

        this.setData({ deleting: true });

        wx.request({
          url: `${apiBaseUrl}/api/auth/account`,
          method: "DELETE",
          header: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`
          },
          success: (res) => {
            if (!res.data?.ok) {
              wx.showToast({
                title: res.data?.message || "注销失败",
                icon: "none"
              });
              return;
            }

            app.globalData.userId = null;
            app.globalData.openId = "";
            app.globalData.token = "";
            app.globalData.identity = "";
            app.globalData.userInfo = null;
            app.globalData.userNo = "";
            app.globalData.role = 0;
            wx.removeStorageSync("selectedRole");
            wx.removeStorageSync("authToken");

            try {
              const { hideMineTabRedDot } = require("../../utils/pending-accept-order-badge.js");
              hideMineTabRedDot();
            } catch (_e) {}

            wx.showToast({
              title: "已注销",
              icon: "success"
            });

            setTimeout(() => {
              wx.reLaunch({
                url: "/pages/loading/loading"
              });
            }, 800);
          },
          fail: () => {
            wx.showToast({
              title: "网络异常，请稍后重试",
              icon: "none"
            });
          },
          complete: () => {
            this.setData({ deleting: false });
          }
        });
      }
    });
  }
});
