import { startEid } from "../../mp_ecard_sdk/main";

Page({
  data: {
    apiBaseUrl: "",
    realName: "",
    idCardNo: "",
    eidToken: "",
    statusText: "正在自动登录...",
    resultText: "",
    loading: false,
    loginLoading: false,
    loggedIn: false,
    verified: false
  },

  onLoad() {
    const app = getApp();
    if (typeof app.refreshApiBaseFromStorage === "function") {
      app.refreshApiBaseFromStorage();
    }
    this.setData({
      apiBaseUrl: app.globalData.apiBaseUrl || ""
    });
    this.ensureLoggedIn()
      .then(() => {
        this.setData({
          loggedIn: true,
          statusText: "已登录，等待开始"
        });
      })
      .catch((err) => {
        this.setData({
          loggedIn: false,
          statusText: "登录失败",
          resultText: (err && err.message) || "自动登录失败，请重试"
        });
      });
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
        data: { code },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !body.token) {
            reject(new Error(body.message || `登录失败(${res.statusCode})`));
            return;
          }
          const user = body.user || {};
          app.globalData.token = body.token;
          app.globalData.openId = user.openid || "";
          app.globalData.userId = user.id != null ? user.id : null;
          app.globalData.userNo = user.userNo || "";
          app.globalData.role = Number(user.role || 0);
          wx.setStorageSync("authToken", body.token);
          wx.setStorageSync("selectedRole", app.globalData.role);
          resolve(body.token);
        },
        fail: () => reject(new Error("网络异常，登录失败"))
      });
    });
  },

  ensureLoggedIn() {
    const app = getApp();
    if (app.globalData.token) {
      return Promise.resolve(app.globalData.token);
    }
    try {
      const stored = wx.getStorageSync("authToken");
      if (stored) {
        app.globalData.token = stored;
        return Promise.resolve(stored);
      }
    } catch (_e) {}
    if (this._loginPromise) return this._loginPromise;
    this.setData({ loginLoading: true });
    this._loginPromise = new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (!res.code) {
            reject(new Error("微信登录未返回 code"));
            return;
          }
          this.requestLogin(res.code).then(resolve).catch(reject);
        },
        fail: () => reject(new Error("微信登录失败"))
      });
    })
      .finally(() => {
        this._loginPromise = null;
        this.setData({ loginLoading: false });
      });
    return this._loginPromise;
  },

  onRealNameInput(e) {
    this.setData({
      realName: (e.detail && e.detail.value) || "",
      verified: false,
      eidToken: "",
      resultText: ""
    });
  },

  onIdCardNoInput(e) {
    this.setData({
      idCardNo: (e.detail && e.detail.value) || "",
      verified: false,
      eidToken: "",
      resultText: ""
    });
  },

  ensureReady() {
    if (!String(this.data.realName || "").trim()) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return false;
    }
    if (String(this.data.idCardNo || "").trim().length < 15) {
      wx.showToast({ title: "请输入身份证号", icon: "none" });
      return false;
    }
    return true;
  },

  requestEidToken() {
    const app = getApp();
    const realName = String(this.data.realName || "").trim();
    const idCardNo = String(this.data.idCardNo || "").trim().toUpperCase();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/eid/token`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token}`
        },
        data: { realName, idCardNo },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !body.eidToken) {
            reject(new Error(body.message || `获取Token失败(${res.statusCode})`));
            return;
          }
          resolve(String(body.eidToken).trim());
        },
        fail: () => reject(new Error("网络异常，获取Token失败"))
      });
    });
  },

  verifyEidResult(eidToken) {
    const app = getApp();
    const realName = String(this.data.realName || "").trim();
    const idCardNo = String(this.data.idCardNo || "").trim().toUpperCase();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/eid/result`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token}`
        },
        data: { eidToken, realName, idCardNo },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !body.verified) {
            reject(new Error(body.message || `核验结果失败(${res.statusCode})`));
            return;
          }
          resolve(true);
        },
        fail: () => reject(new Error("网络异常，拉取结果失败"))
      });
    });
  },

  onStartDemo() {
    if (this.data.loading || !this.ensureReady()) return;
    this.setData({
      loading: true,
      verified: false,
      eidToken: "",
      statusText: "正在登录...",
      resultText: ""
    });
    this.ensureLoggedIn()
      .then(() => {
        this.setData({
          loggedIn: true,
          statusText: "正在获取EidToken..."
        });
        wx.showLoading({ title: "获取Token..." });
        return this.requestEidToken();
      })
      .then((eidToken) => {
        wx.hideLoading();
        this.setData({
          eidToken,
          statusText: "已获取Token，正在打开E证通..."
        });
        startEid({
          data: {
            token: eidToken,
            needJumpPage: false,
            enableEmbedded: false
          },
          verifyDoneCallback: (result) => {
            const token = String((result && result.token) || eidToken).trim();
            this.setData({
              loading: true,
              statusText: "E证通已返回，正在拉取核验结果..."
            });
            wx.showLoading({ title: "拉取结果..." });
            this.verifyEidResult(token)
              .then(() => {
                this.setData({
                  eidToken: token,
                  verified: true,
                  statusText: "核验通过",
                  resultText: "E证通人脸核身已通过"
                });
                wx.showToast({ title: "核验通过", icon: "success" });
              })
              .catch((err) => {
                this.setData({
                  verified: false,
                  statusText: "核验未通过",
                  resultText: (err && err.message) || "E证通核验未通过"
                });
                wx.showToast({ title: this.data.resultText, icon: "none" });
              })
              .finally(() => {
                wx.hideLoading();
                this.setData({ loading: false });
              });
          }
        });
        this.setData({ loading: false });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({
          loading: false,
          statusText: "准备失败",
          resultText: (err && err.message) || "登录或获取Token失败"
        });
        wx.showToast({ title: this.data.resultText, icon: "none" });
      });
  },

  onCopyToken() {
    const token = String(this.data.eidToken || "").trim();
    if (!token) {
      wx.showToast({ title: "暂无Token", icon: "none" });
      return;
    }
    wx.setClipboardData({ data: token });
  }
});
