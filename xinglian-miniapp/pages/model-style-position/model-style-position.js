const { prepareImageForUpload } = require("../../utils/image-upload.js");
const {
  getReviewItem,
  contentReviewBannerText,
  contentReviewBannerType,
  photoReviewBannerText,
  photoReviewBannerType
} = require("../../utils/content-review.js");
const { swapAdjacent, toastIfNotMoved } = require("../../utils/photo-list-actions.js");

const MAX_PHOTOS = 100;
const MAX_PICK_COUNT = 9;
const ACCEPT_EXT = [".jpg", ".jpeg", ".png"];

Page({
  data: {
    photos: [],
    totalPhotos: 0,
    saving: false,
    reviewBannerText: "",
    reviewBannerType: ""
  },

  syncReviewBanner(contentReview, photos) {
    const item = getReviewItem(contentReview, "stylePosition");
    this.setData({
      reviewBannerText: contentReviewBannerText(item, photos || this.data.photos),
      reviewBannerType: contentReviewBannerType(item, photos || this.data.photos)
    });
  },

  decoratePhoto(photo) {
    const next = { ...photo };
    next.reviewBadgeText = photoReviewBannerText(next);
    next.reviewBadgeType = photoReviewBannerType(next);
    return next;
  },

  genId() {
    return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  },

  patchPhotos(photos, skipSave) {
    const next = Array.isArray(photos) ? photos.slice(0, MAX_PHOTOS).map((p) => this.decoratePhoto(p)) : [];
    this.setData(
      {
        photos: next,
        totalPhotos: next.length
      },
      () => {
        if (!skipSave) this.saveRemote();
      }
    );
  },

  async onLoad() {
    try {
      const data = await this.requestWithAuth("/api/models/me", "GET");
      this.syncReviewBanner(data?.contentReview);
      const source = data?.stylePosition;
      const photos = Array.isArray(source?.photos)
        ? source.photos
            .map((p) =>
              this.decoratePhoto({
                id: p.id || this.genId(),
                url: p.url,
                reviewStatus: p.reviewStatus,
                rejectReason: p.rejectReason
              })
            )
            .filter((p) => p.url)
        : [];
      this.patchPhotos(photos, true);
    } catch (_error) {}
  },

  saveRemote() {
    if (this.data.saving) return Promise.resolve();
    this.setData({ saving: true });
    const photos = (this.data.photos || []).map((p) => ({
      id: p.id,
      url: p.url
    }));
    return this.requestWithAuth("/api/models/style-position", "PUT", { photos })
      .then((data) => {
        if (data?.contentReview) this.syncReviewBanner(data.contentReview);
        else this.syncReviewBanner({ stylePosition: { pendingCount: 1 } }, this.data.photos);
      })
      .catch(() => {
        wx.showToast({ title: "保存失败，请稍后重试", icon: "none" });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },

  async uploadTempFile(path) {
    const app = getApp();
    const filePath = await prepareImageForUpload(path);
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/models/style-position/upload`,
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
          resolve(body.url);
        },
        fail: () => reject(new Error("网络异常"))
      });
    });
  },

  choosePhotos() {
    const remain = MAX_PHOTOS - this.data.photos.length;
    if (remain <= 0) {
      wx.showToast({ title: "已达100张上限", icon: "none" });
      return;
    }

    wx.chooseMedia({
      count: Math.min(remain, MAX_PICK_COUNT),
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const tempFiles = res.tempFiles || [];
        const valid = [];
        tempFiles.forEach((file) => {
          const path = (file.tempFilePath || "").toLowerCase();
          const extOk = ACCEPT_EXT.some((ext) => path.endsWith(ext));
          if (!extOk) return;
          valid.push(file.tempFilePath);
        });

        if (!valid.length) {
          wx.showToast({ title: "仅支持JPG/PNG", icon: "none" });
          return;
        }

        wx.showLoading({ title: "上传中...", mask: true });
        let photos = [...this.data.photos];
        try {
          for (const path of valid) {
            const url = await this.uploadTempFile(path);
            photos.push({
              id: this.genId(),
              url
            });
          }
          this.patchPhotos(photos);
          wx.showToast({ title: "上传成功", icon: "success" });
        } catch (err) {
          wx.showToast({
            title: (err && err.message) || "上传失败",
            icon: "none"
          });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  previewPhoto(e) {
    const photoId = e.currentTarget.dataset.photoId;
    const photos = this.data.photos || [];
    const photo = photos.find((p) => p.id === photoId);
    const urls = photos.map((p) => p.url).filter(Boolean);
    if (!photo || !urls.length) return;
    wx.previewImage({
      current: photo.url,
      urls
    });
  },

  onPhotoMore(e) {
    const photoId = e.currentTarget.dataset.photoId || "";
    if (!photoId) return;
    wx.showActionSheet({
      itemList: ["前移", "后移", "删除照片"],
      success: (res) => {
        if (res.tapIndex === 0) this.movePhoto(photoId, "up");
        else if (res.tapIndex === 1) this.movePhoto(photoId, "down");
        else if (res.tapIndex === 2) this.removePhotoById(photoId);
      }
    });
  },

  movePhoto(photoId, direction) {
    const photos = this.data.photos || [];
    const index = photos.findIndex((p) => p.id === photoId);
    const { list: next, moved } = swapAdjacent(photos, index, direction);
    toastIfNotMoved(moved, direction);
    if (moved) this.patchPhotos(next);
  },

  removePhoto(e) {
    const photoId = e.currentTarget.dataset.photoId;
    if (!photoId) return;
    this.removePhotoById(photoId);
  },

  removePhotoById(photoId) {
    wx.showModal({
      title: "删除照片",
      content: "确定从风格定位中删除这张照片？",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        const photos = (this.data.photos || []).filter((p) => p.id !== photoId);
        this.patchPhotos(photos);
      }
    });
  }
});
