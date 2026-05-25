const { prepareImageForUpload } = require("../../utils/image-upload.js");

const MAX_FOLDERS = 10;
const MAX_PHOTOS = 100;
const ACCEPT_EXT = [".jpg", ".jpeg", ".png"];

Page({
  data: {
    folders: [],
    photos: [],
    folderBlocks: [],
    totalPhotos: 0
  },

  genId() {
    return `pf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

  /** 每个文件夹独立封面：coverPhotoId 必须指向该文件夹内照片，否则回落为第一张 */
  ensureFolderCovers(folders, photos) {
    return folders.map((f) => {
      const inFolder = (photos || []).filter((p) => p.folderId === f.id);
      if (!inFolder.length) return { id: f.id, name: f.name };
      let cid = f.coverPhotoId;
      if (!cid || !inFolder.some((p) => p.id === cid)) cid = inFolder[0].id;
      return { id: f.id, name: f.name, coverPhotoId: cid };
    });
  },

  rebuildFolderBlocks(folders, photos) {
    const list = folders || [];
    const plist = photos || [];
    const folderBlocks = list.map((f) => {
      const fps = plist.filter((p) => p.folderId === f.id);
      const cov = f.coverPhotoId;
      const resolvedCoverId =
        cov && fps.some((p) => p.id === cov) ? cov : fps[0]?.id;
      const coverPhotoObj = resolvedCoverId ? fps.find((p) => p.id === resolvedCoverId) : null;
      const coverThumbUrl = coverPhotoObj ? coverPhotoObj.url : "";
      const photosWithFlag = fps.map((p) => ({
        ...p,
        isFolderCover: resolvedCoverId === p.id
      }));
      return {
        id: f.id,
        name: f.name,
        coverThumbUrl: coverThumbUrl || "",
        photos: photosWithFlag
      };
    });
    return {
      folderBlocks,
      totalPhotos: plist.length
    };
  },

  patchPortfolio(nextFolders, nextPhotos, skipSave) {
    const ensuredFolders = this.ensureFolderCovers(nextFolders, nextPhotos);
    const { folderBlocks, totalPhotos } = this.rebuildFolderBlocks(ensuredFolders, nextPhotos);
    this.setData(
      {
        folders: ensuredFolders,
        photos: nextPhotos,
        folderBlocks,
        totalPhotos
      },
      () => {
        if (!skipSave) this.saveRemote();
      }
    );
  },

  async onLoad() {
    try {
      const data = await this.requestWithAuth("/api/models/me", "GET");
      if (!data?.ok || !data.portfolio) return;
      const pf = data.portfolio;
      let folders = Array.isArray(pf.folders) ? pf.folders : [];
      const legacyCats = Array.isArray(pf.categories) ? pf.categories : [];
      if (!folders.length && legacyCats.length) {
        folders = legacyCats
          .map((c, i) => {
            if (typeof c === "string") {
              const name = c.trim();
              return name ? { id: `legacy_${i}_${name}`, name } : null;
            }
            if (c && typeof c === "object" && c.name) {
              return {
                id: c.id || `legacy_${i}`,
                name: String(c.name).trim(),
                coverPhotoId: c.coverPhotoId
              };
            }
            return null;
          })
          .filter(Boolean);
      }
      folders = folders.map((f) => ({
        id: f.id,
        name: f.name,
        ...(f.coverPhotoId ? { coverPhotoId: f.coverPhotoId } : {})
      }));
      let photos = (pf.photos || []).map((p) => ({
        id: p.id || this.genId(),
        folderId: p.folderId || "",
        url: p.url,
        categories: p.categories || []
      }));
      const nameToId = {};
      folders.forEach((f) => {
        nameToId[f.name] = f.id;
      });
      photos.forEach((p) => {
        if (!p.folderId && p.categories && p.categories.length) {
          const nm = String(p.categories[0]).trim();
          p.folderId = nameToId[nm] || folders[0]?.id || "";
        }
      });
      this.patchPortfolio(folders, photos, true);
    } catch (_error) {}
  },

  saveRemote() {
    const folders = this.ensureFolderCovers(this.data.folders, this.data.photos);
    const photos = (this.data.photos || []).map((p) => ({
      id: p.id,
      folderId: p.folderId,
      url: p.url
    }));
    return this.requestWithAuth("/api/models/portfolio", "PUT", { folders, photos }).catch(() => {});
  },

  addFolder() {
    if (this.data.folders.length >= MAX_FOLDERS) {
      wx.showToast({ title: "最多10个文件夹", icon: "none" });
      return;
    }
    wx.showModal({
      title: "新建文件夹",
      editable: true,
      placeholderText: "例如：平面样片",
      success: (res) => {
        if (!res.confirm) return;
        const name = (res.content || "").trim();
        if (!name) return;
        if (this.data.folders.some((f) => f.name === name)) {
          wx.showToast({ title: "名称已存在", icon: "none" });
          return;
        }
        const folder = { id: this.genId(), name };
        this.patchPortfolio([...this.data.folders, folder], this.data.photos);
      }
    });
  },

  renameFolder(e) {
    const id = e.currentTarget.dataset.id;
    const folders = this.data.folders || [];
    const idx = folders.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const oldName = folders[idx].name;
    wx.showModal({
      title: "重命名",
      editable: true,
      placeholderText: oldName,
      success: (res) => {
        if (!res.confirm) return;
        const name = (res.content || "").trim();
        if (!name || name === oldName) return;
        if (folders.some((f, fidx) => fidx !== idx && f.name === name)) {
          wx.showToast({ title: "名称已存在", icon: "none" });
          return;
        }
        const nextFolders = folders.map((f, i) => (i === idx ? { ...f, name } : f));
        this.patchPortfolio(nextFolders, this.data.photos);
      }
    });
  },

  deleteFolder(e) {
    const id = e.currentTarget.dataset.id;
    const folders = this.data.folders || [];
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const cnt = (this.data.photos || []).filter((p) => p.folderId === id).length;
    wx.showModal({
      title: "删除文件夹",
      content: cnt ? `将同时删除其中 ${cnt} 张照片，确定删除「${folder.name}」？` : `确定删除空文件夹「${folder.name}」？`,
      success: (res) => {
        if (!res.confirm) return;
        const nextFolders = folders.filter((f) => f.id !== id);
        const nextPhotos = (this.data.photos || []).filter((p) => p.folderId !== id);
        this.patchPortfolio(nextFolders, nextPhotos);
      }
    });
  },

  async uploadTempFile(path) {
    const app = getApp();
    const filePath = await prepareImageForUpload(path);
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/models/portfolio/upload`,
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

  choosePhotosForFolder(e) {
    const folderId = e.currentTarget.dataset.folderId;
    const folders = this.data.folders || [];
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) {
      wx.showToast({ title: "文件夹不存在", icon: "none" });
      return;
    }

    const remain = MAX_PHOTOS - this.data.photos.length;
    if (remain <= 0) {
      wx.showToast({ title: "已达100张上限", icon: "none" });
      return;
    }

    wx.chooseMedia({
      count: Math.min(remain, 9),
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
              folderId: folder.id,
              url
            });
          }
          this.patchPortfolio(folders, photos);
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

  previewInFolder(e) {
    const photoId = e.currentTarget.dataset.photoId;
    const folderId = e.currentTarget.dataset.folderId;
    const blocks = this.data.folderBlocks || [];
    const block = blocks.find((b) => b.id === folderId);
    const plist = block?.photos || [];
    const urls = plist.map((p) => p.url).filter(Boolean);
    const photo = plist.find((p) => p.id === photoId);
    if (!photo || !urls.length) return;
    wx.previewImage({
      current: photo.url,
      urls
    });
  },

  onPhotoMore(e) {
    const photoId = e.currentTarget.dataset.photoId;
    const folderId = e.currentTarget.dataset.folderId;
    if (!photoId) return;
    wx.showActionSheet({
      itemList: ["设为该文件夹封面", "移动到其他文件夹…", "删除这张照片"],
      success: (res) => {
        const idx = res.tapIndex;
        if (idx === 0) this.setFolderCover(photoId, folderId);
        else if (idx === 1) this.movePhotoPickFolder(photoId, folderId);
        else if (idx === 2) this.removePhotoById(photoId);
      }
    });
  },

  setFolderCover(photoId, folderId) {
    const folders = this.data.folders.map((f) =>
      f.id === folderId ? { ...f, coverPhotoId: photoId } : f
    );
    this.patchPortfolio(folders, this.data.photos);
    wx.showToast({ title: "已设为文件夹封面", icon: "none" });
  },

  movePhotoPickFolder(photoId, currentFolderId) {
    const folders = this.data.folders || [];
    const candidates = folders.filter((f) => f.id !== currentFolderId);
    if (!candidates.length) {
      wx.showToast({ title: "没有其他文件夹", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: candidates.map((f) => `移到「${f.name}」`),
      success: (res) => {
        const targetFolder = candidates[res.tapIndex];
        if (!targetFolder) return;
        let photos = (this.data.photos || []).map((p) =>
          p.id === photoId ? { ...p, folderId: targetFolder.id } : p
        );
        this.patchPortfolio(folders, photos);
        wx.showToast({ title: "已移动", icon: "none" });
      }
    });
  },

  removePhotoById(photoId) {
    wx.showModal({
      title: "删除照片",
      content: "确定删除？删除后不可恢复。",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        const photos = (this.data.photos || []).filter((p) => p.id !== photoId);
        this.patchPortfolio(this.data.folders, photos);
      }
    });
  }
});
