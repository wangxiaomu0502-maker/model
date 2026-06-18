const CONTENT_REVIEW_STATUS = {
  DRAFT: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3
};

function normalizePhotoReviewStatus(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return CONTENT_REVIEW_STATUS.APPROVED;
  return n;
}

function getReviewItem(contentReview, key) {
  const review = contentReview && typeof contentReview === "object" ? contentReview : {};
  const item = review[key] || {};
  return {
    status: Number(item.status ?? CONTENT_REVIEW_STATUS.APPROVED),
    rejectReason: item.rejectReason ? String(item.rejectReason) : "",
    pendingCount: Number(item.pendingCount ?? 0),
    rejectedCount: Number(item.rejectedCount ?? 0)
  };
}

function summarizePhotosReview(photos) {
  const list = Array.isArray(photos) ? photos : [];
  let pending = 0;
  let rejected = 0;
  list.forEach((photo) => {
    const url = String((photo && photo.url) || "").trim();
    if (!url) return;
    const status = normalizePhotoReviewStatus(photo.reviewStatus);
    if (status === CONTENT_REVIEW_STATUS.PENDING) pending += 1;
    if (status === CONTENT_REVIEW_STATUS.REJECTED) rejected += 1;
  });
  return { pending, rejected };
}

function contentReviewBannerText(item, photos) {
  const summary = summarizePhotosReview(photos);
  const pending = summary.pending || Number(item.pendingCount || 0);
  const rejected = summary.rejected || Number(item.rejectedCount || 0);
  if (pending > 0) {
    return `${pending}张照片待审核，通过前不会在用户端展示`;
  }
  if (rejected > 0) {
    const rejectedPhoto = (Array.isArray(photos) ? photos : []).find((photo) => {
      const url = String((photo && photo.url) || "").trim();
      return url && normalizePhotoReviewStatus(photo.reviewStatus) === CONTENT_REVIEW_STATUS.REJECTED;
    });
    const reason = rejectedPhoto && rejectedPhoto.rejectReason
      ? String(rejectedPhoto.rejectReason).trim()
      : "";
    if (reason) return `${rejected}张照片未通过：${reason}`;
    return `${rejected}张照片未通过审核，请修改后重新保存`;
  }
  return "";
}

function contentReviewBannerType(item, photos) {
  const summary = summarizePhotosReview(photos);
  const pending = summary.pending || Number(item.pendingCount || 0);
  const rejected = summary.rejected || Number(item.rejectedCount || 0);
  if (pending > 0) return "pending";
  if (rejected > 0) return "rejected";
  return "";
}

function photoReviewBannerText(photo) {
  const status = normalizePhotoReviewStatus(photo && photo.reviewStatus);
  if (status === CONTENT_REVIEW_STATUS.PENDING) return "待审核";
  if (status === CONTENT_REVIEW_STATUS.REJECTED) {
    const reason = photo && photo.rejectReason ? String(photo.rejectReason).trim() : "";
    return reason ? `未通过：${reason}` : "未通过";
  }
  return "";
}

function photoReviewBannerType(photo) {
  const status = normalizePhotoReviewStatus(photo && photo.reviewStatus);
  if (status === CONTENT_REVIEW_STATUS.PENDING) return "pending";
  if (status === CONTENT_REVIEW_STATUS.REJECTED) return "rejected";
  return "";
}

module.exports = {
  CONTENT_REVIEW_STATUS,
  getReviewItem,
  contentReviewBannerText,
  contentReviewBannerType,
  photoReviewBannerText,
  photoReviewBannerType,
  normalizePhotoReviewStatus
};
