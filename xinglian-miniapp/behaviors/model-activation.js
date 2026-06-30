const ACTIVATION_REQUIRED_MESSAGE = "请先输入授权码激活后再上传";

module.exports = Behavior({
  data: {
    isActivated: false,
    showActivationModal: false,
    activationCodeInput: "",
    activationError: "",
    activationLoading: false
  },

  methods: {
    preventActivationModalBubble() {},

    syncActivationStatusFromMe(data) {
      const payload = data && typeof data === "object" ? data : {};
      this.setData({
        isActivated: Boolean(payload.isActivated)
      });
    },

    refreshActivationStatus() {
      const app = getApp();
      if (!app.globalData.token) return;
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/models/me`,
        method: "GET",
        header: {
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (res) => {
          const data = res.data || {};
          if (res.statusCode === 200 && data.ok) {
            this.syncActivationStatusFromMe(data);
          }
        }
      });
    },

    isActivationRequiredError(statusCode, message) {
      const text = String(message || "").trim();
      if (statusCode === 403 && text.includes("激活")) return true;
      return text.includes(ACTIVATION_REQUIRED_MESSAGE) || text.includes("授权码激活");
    },

    openActivationModal(message) {
      this.setData({
        showActivationModal: true,
        activationCodeInput: "",
        activationError: message || ACTIVATION_REQUIRED_MESSAGE
      });
    },

    closeActivationModal() {
      this.setData({
        showActivationModal: false,
        activationCodeInput: "",
        activationError: "",
        activationLoading: false
      });
      this._pendingUploadAction = null;
    },

    onActivationCodeInput(e) {
      this.setData({
        activationCodeInput: String((e.detail && e.detail.value) || "").trim(),
        activationError: ""
      });
    },

    ensureActivatedBeforeUpload(action) {
      if (this.data.isActivated) {
        if (typeof action === "function") {
          return Promise.resolve().then(() => action());
        }
        return Promise.resolve(true);
      }
      this._pendingUploadAction = typeof action === "function" ? action : null;
      this.openActivationModal();
      return Promise.resolve(false);
    },

    onSubmitActivationCode() {
      const code = String(this.data.activationCodeInput || "").trim();
      if (!/^[0-9A-Za-z]{8}$/.test(code)) {
        this.setData({ activationError: "请输入 8 位数字或字母授权码" });
        return;
      }

      const app = getApp();
      if (!app.globalData.token) {
        wx.showToast({ title: "登录状态失效，请重新打开小程序", icon: "none" });
        return;
      }

      this.setData({
        activationLoading: true,
        activationError: ""
      });

      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/models/activate-with-code`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token}`
        },
        data: { code },
        success: (res) => {
          const data = res.data || {};
          if (!data.ok) {
            const msg = data.message || "授权码无效或已被使用";
            this.setData({ activationError: msg });
            wx.showToast({ title: msg, icon: "none", duration: 2800 });
            return;
          }

          this.setData({
            isActivated: true,
            showActivationModal: false,
            activationCodeInput: "",
            activationError: ""
          });

          wx.showToast({ title: "激活成功", icon: "success" });
          const pending = this._pendingUploadAction;
          this._pendingUploadAction = null;
          if (typeof pending === "function") {
            setTimeout(() => pending(), 300);
          }
        },
        fail: () => {
          const msg = "网络异常，请稍后重试";
          this.setData({ activationError: msg });
          wx.showToast({ title: msg, icon: "none" });
        },
        complete: () => {
          this.setData({ activationLoading: false });
        }
      });
    }
  }
});
