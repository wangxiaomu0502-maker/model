function findHomeBannerById(banners, id) {
  const targetId = Number(id || 0);
  if (!targetId) return null;
  return (banners || []).find((item) => Number(item.id) === targetId) || null;
}

function openHomeBannerPreview(page, id) {
  const banner = findHomeBannerById(page.data.banners, id);
  if (!banner) return;

  if (banner.type === "image") {
    const url = String(banner.imageUrl || "").trim();
    if (!url) {
      wx.showToast({ title: "暂无展示图", icon: "none" });
      return;
    }
    wx.previewImage({ current: url, urls: [url] });
    return;
  }

  if (banner.type === "video") {
    const videoUrl = String(banner.videoUrl || "").trim();
    if (!videoUrl) {
      wx.showToast({ title: "暂无视频", icon: "none" });
      return;
    }
    const coverUrl = String(banner.coverUrl || "").trim();
    if (typeof wx.previewMedia === "function") {
      wx.showLoading({ title: "加载视频", mask: true });
      wx.downloadFile({
        url: videoUrl,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode !== 200 || !res.tempFilePath) {
            wx.showModal({
              title: "视频无法播放",
              content:
                "文件虽是 MP4，但可能是 H.265 编码，小程序不支持。请让管理员在后管重新上传 H.264 编码的 MP4。",
              showCancel: false
            });
            return;
          }
          wx.previewMedia({
            sources: [
              {
                url: res.tempFilePath,
                type: "video",
                poster: coverUrl || undefined
              }
            ],
            fail: () => {
              wx.showModal({
                title: "视频无法播放",
                content:
                  "文件虽是 MP4，但可能是 H.265 编码，小程序不支持。请让管理员在后管重新上传 H.264 编码的 MP4。",
                showCancel: false
              });
            }
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showModal({
            title: "视频加载失败",
            content: "请检查网络，或确认小程序已配置视频域名白名单。",
            showCancel: false
          });
        }
      });
      return;
    }
    page.setData(
      {
        bannerVideoVisible: true,
        bannerVideoUrl: videoUrl,
        bannerVideoCover: coverUrl
      },
      () => {
        setTimeout(() => {
          try {
            wx.createVideoContext("homeBannerVideo", page).play();
          } catch (_e) {
            /* ignore */
          }
        }, 200);
      }
    );
  }
}

function closeHomeBannerVideoPreview(page) {
  try {
    wx.createVideoContext("homeBannerVideo", page).stop();
  } catch (_e) {
    /* ignore */
  }
  page.setData({
    bannerVideoVisible: false,
    bannerVideoUrl: "",
    bannerVideoCover: ""
  });
}

function onHomeBannerVideoError(page, e) {
  const detail = (e && e.detail) || {};
  wx.showToast({
    title: detail.errMsg || "视频播放失败，请使用 H.264 编码的 MP4",
    icon: "none",
    duration: 3000
  });
  closeHomeBannerVideoPreview(page);
}

function preventBannerPreviewBubble() {}

module.exports = {
  openHomeBannerPreview,
  closeHomeBannerVideoPreview,
  onHomeBannerVideoError,
  preventBannerPreviewBubble
};
