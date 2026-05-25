const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_LABEL = "5M";
const DEFAULT_COMPRESS_QUALITY = 75;

function getFileSize(filePath) {
  return new Promise((resolve) => {
    if (!filePath || !wx.getFileInfo) {
      resolve(0);
      return;
    }

    wx.getFileInfo({
      filePath,
      success: (res) => resolve(Number(res.size || 0)),
      fail: () => resolve(0)
    });
  });
}

function compressImage(filePath, quality = DEFAULT_COMPRESS_QUALITY) {
  return new Promise((resolve) => {
    if (!filePath || !wx.compressImage) {
      resolve(filePath);
      return;
    }

    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath)
    });
  });
}

async function prepareImageForUpload(filePath, options = {}) {
  const quality = Number(options.quality || DEFAULT_COMPRESS_QUALITY);
  const maxSize = Number(options.maxSize || MAX_UPLOAD_IMAGE_BYTES);
  const compressedPath = await compressImage(filePath, quality);
  const size = await getFileSize(compressedPath);

  if (maxSize > 0 && size > maxSize) {
    throw new Error(`图片大小不能超过${MAX_UPLOAD_IMAGE_LABEL}`);
  }

  return compressedPath;
}

module.exports = {
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_IMAGE_LABEL,
  prepareImageForUpload
};
