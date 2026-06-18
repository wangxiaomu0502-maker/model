/** 在列表中与前/后相邻项交换位置 */
function swapAdjacent(list, index, direction) {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= list.length || targetIndex < 0 || targetIndex >= list.length) {
    return { list, moved: false };
  }
  const next = list.slice();
  const tmp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = tmp;
  return { list: next, moved: true };
}

/** 在同一文件夹内调整照片顺序（全局 photos 数组） */
function swapPhotosInFolder(photos, photoId, folderId, direction) {
  const arr = Array.isArray(photos) ? photos : [];
  const folderPhotos = arr.filter((p) => p.folderId === folderId);
  const idx = folderPhotos.findIndex((p) => p.id === photoId);
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= folderPhotos.length) {
    return { photos: arr, moved: false };
  }
  const idA = folderPhotos[idx].id;
  const idB = folderPhotos[targetIdx].id;
  const globalA = arr.findIndex((p) => p.id === idA);
  const globalB = arr.findIndex((p) => p.id === idB);
  if (globalA < 0 || globalB < 0) {
    return { photos: arr, moved: false };
  }
  const next = arr.slice();
  const tmp = next[globalA];
  next[globalA] = next[globalB];
  next[globalB] = tmp;
  return { photos: next, moved: true };
}

function toastIfNotMoved(moved, direction) {
  if (moved) return;
  wx.showToast({
    title: direction === "up" ? "已在最前" : "已在最后",
    icon: "none"
  });
}

module.exports = {
  swapAdjacent,
  swapPhotosInFolder,
  toastIfNotMoved
};
