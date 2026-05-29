const { prepareImageForUpload } = require("../../utils/image-upload.js");

Page({
  data: {
    honors: [],
    loading: true,
    saving: false,
    formVisible: false,
    editingId: null,
    formTitle: "",
    formImageUrl: "",
    formImagePreview: ""
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "荣誉展示" });
    this.loadHonors();
  },

  requestWithAuth(url, method, data) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}${url}`,
        method,
        data,
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) {
            resolve(body);
            return;
          }
          reject(new Error(body.message || "请求失败"));
        },
        fail: () => reject(new Error("网络异常"))
      });
    });
  },

  async loadHonors() {
    this.setData({ loading: true });
    try {
      const data = await this.requestWithAuth("/api/models/honors", "GET");
      const list = Array.isArray(data.list) ? data.list : [];
      this.setData({ honors: list, loading: false });
    } catch (err) {
      this.setData({ honors: [], loading: false });
      wx.showToast({ title: err.message || "加载失败", icon: "none" });
    }
  },

  openCreateForm() {
    this.setData({
      formVisible: true,
      editingId: null,
      formTitle: "",
      formImageUrl: "",
      formImagePreview: ""
    });
  },

  openEditForm(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    const item = (this.data.honors || []).find((h) => Number(h.id) === id);
    if (!item) return;
    this.setData({
      formVisible: true,
      editingId: id,
      formTitle: item.title || "",
      formImageUrl: item.imageUrl || "",
      formImagePreview: item.imageUrl || ""
    });
  },

  closeForm() {
    if (this.data.saving) return;
    this.setData({ formVisible: false });
  },

  preventBubble() {},

  onTitleInput(e) {
    this.setData({ formTitle: String(e.detail.value || "").trimStart() });
  },

  async uploadTempFile(path) {
    const app = getApp();
    const filePath = await prepareImageForUpload(path);
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/models/honors/upload`,
        filePath,
        name: "file",
        header: {
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (uploadRes) => {
          let body = {};
          try {
            body = JSON.parse(uploadRes.data || "{}");
          } catch (_err) {
            body = {};
          }
          if (uploadRes.statusCode !== 200 || !body.ok || !body.url) {
            reject(new Error(body.message || `上传失败(${uploadRes.statusCode})`));
            return;
          }
          resolve(String(body.url));
        },
        fail: () => reject(new Error("网络异常"))
      });
    });
  },

  chooseHonorImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) return;
        wx.showLoading({ title: "上传中…", mask: true });
        try {
          const url = await this.uploadTempFile(file.tempFilePath);
          this.setData({
            formImageUrl: url,
            formImagePreview: url
          });
        } catch (err) {
          wx.showToast({ title: err.message || "上传失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  removeHonorImage() {
    this.setData({ formImageUrl: "", formImagePreview: "" });
  },

  previewHonorImage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  async submitForm() {
    if (this.data.saving) return;
    const title = String(this.data.formTitle || "").trim();
    if (!title) {
      wx.showToast({ title: "请填写荣誉名称", icon: "none" });
      return;
    }
    const payload = {
      title,
      imageUrl: this.data.formImageUrl || null
    };
    this.setData({ saving: true });
    try {
      if (this.data.editingId) {
        await this.requestWithAuth(`/api/models/honors/${this.data.editingId}`, "PATCH", payload);
        wx.showToast({ title: "已更新", icon: "success" });
      } else {
        await this.requestWithAuth("/api/models/honors", "POST", payload);
        wx.showToast({ title: "已添加", icon: "success" });
      }
      this.setData({ formVisible: false, saving: false });
      await this.loadHonors();
    } catch (err) {
      this.setData({ saving: false });
      wx.showToast({ title: err.message || "保存失败", icon: "none" });
    }
  },

  deleteHonor(e) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (!id) return;
    wx.showModal({
      title: "删除荣誉",
      content: "确定删除这条荣誉吗？",
      confirmColor: "#db2777",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await this.requestWithAuth(`/api/models/honors/${id}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          await this.loadHonors();
        } catch (err) {
          wx.showToast({ title: err.message || "删除失败", icon: "none" });
        }
      }
    });
  }
});
