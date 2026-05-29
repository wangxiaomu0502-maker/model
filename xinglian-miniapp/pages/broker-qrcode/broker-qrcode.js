Page({
  data: {
    qrImage: "",
    qrErrorText: "",
    qrcodeLoading: false,
    loading: true,
    userNo: "",
    nickname: ""
  },

  ensureBrokerRole() {
    const app = getApp();
    const r = Number(app.globalData.role || 0);
    if (r === 3 || r === 4) return true;
    wx.showToast({ title: "仅经纪人或代理人可查看", icon: "none" });
    setTimeout(() => wx.navigateBack(), 1200);
    return false;
  },

  onShow() {
    if (!this.ensureBrokerRole()) return;
    this.loadMe();
  },

  loadMe() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    wx.request({
      url: `${apiBaseUrl}/api/users/me`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const body = res.data || {};
        const user = body.user;
        if (res.statusCode !== 200 || !body.ok || !user) {
          wx.showToast({ title: body.message || "加载失败", icon: "none" });
          this.setData({ loading: false });
          return;
        }
        const userNo = String(user.userNo || "").trim();
        this.setData({
          loading: false,
          userNo,
          nickname: String(user.nickname || "")
        });
        this.loadQrCode();
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },

  loadQrCode() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) return;
    this.setData({ qrcodeLoading: true, qrErrorText: "" });
    wx.request({
      url: `${apiBaseUrl}/api/broker/promo-qrcode?t=${Date.now()}`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
      success: (res) => {
        if (res.statusCode !== 200 || !res.data || !res.data.byteLength) {
          this.setData({ qrErrorText: "二维码生成失败，请稍后重试" });
          wx.showToast({ title: "二维码生成失败", icon: "none" });
          return;
        }
        this.writeQrImageFile(res.data);
      },
      fail: () => {
        this.setData({ qrErrorText: "网络异常，二维码生成失败" });
        wx.showToast({ title: "网络异常", icon: "none" });
      },
      complete: () => {
        this.setData({ qrcodeLoading: false });
      }
    });
  },

  writeQrImageFile(arrayBuffer) {
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/broker-promo-qrcode-${Date.now()}.png`;
    fs.writeFile({
      filePath,
      data: arrayBuffer,
      success: () => {
        this.setData({ qrImage: filePath, qrErrorText: "" });
      },
      fail: () => {
        this.setData({ qrErrorText: "二维码保存失败，请稍后重试" });
        wx.showToast({ title: "二维码保存失败", icon: "none" });
      }
    });
  },

  onCopyUserNo() {
    const no = String(this.data.userNo || "").trim();
    if (!no) {
      wx.showToast({ title: "暂无用户 ID", icon: "none" });
      return;
    }
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: "已复制用户 ID", icon: "success" })
    });
  },

  onPreviewQr() {
    const url = this.data.qrImage;
    if (!url) {
      wx.showToast({ title: this.data.qrcodeLoading ? "二维码生成中" : "暂无二维码", icon: "none" });
      return;
    }
    wx.previewImage({ urls: [url], current: url });
  },

  onSaveQr() {
    const url = this.data.qrImage;
    if (!url) {
      wx.showToast({ title: this.data.qrcodeLoading ? "二维码生成中" : "暂无二维码", icon: "none" });
      return;
    }
    wx.showLoading({ title: "保存中…" });
    wx.saveImageToPhotosAlbum({
      filePath: url,
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: "已保存到相册", icon: "success" });
      },
      fail: (err) => {
        wx.hideLoading();
        const msg = String((err && err.errMsg) || "");
        if (msg.includes("auth deny") || msg.includes("authorize")) {
          wx.showModal({
            title: "需要相册权限",
            content: "请在设置中允许保存图片到相册后重试",
            confirmText: "去设置",
            success: (r) => {
              if (r.confirm) wx.openSetting();
            }
          });
          return;
        }
        wx.showToast({ title: "保存失败", icon: "none" });
      }
    });
  }
});
