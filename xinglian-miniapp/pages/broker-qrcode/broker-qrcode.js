const QR_IMAGE = "/assets/qrcode/qrcode.jpg";

Page({
  data: {
    qrImage: QR_IMAGE,
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
        this.setData({
          loading: false,
          userNo: String(user.userNo || ""),
          nickname: String(user.nickname || "")
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({ loading: false });
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
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  onSaveQr() {
    const url = this.data.qrImage;
    if (!url) return;
    wx.showLoading({ title: "保存中…" });
    wx.getImageInfo({
      src: url,
      success: (info) => {
        wx.saveImageToPhotosAlbum({
          filePath: info.path,
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
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "读取图片失败", icon: "none" });
      }
    });
  }
});
