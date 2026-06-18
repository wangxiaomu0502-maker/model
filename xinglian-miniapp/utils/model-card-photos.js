/** 用户端模卡：身材比例卡图集 1 张 + 身材比例卡单片展示最多 10 张 */
const THREE_VIEW_KEY = "threeView";
const GALLERY_MAX = 10;
const THREE_VIEW_LABEL = "身材比例卡图集";
const GALLERY_LABEL = "身材比例卡单片展示";

function buildGallerySlots() {
  return Array.from({ length: GALLERY_MAX }, (_, index) => ({
    key: `gallery_${index + 1}`,
    label: `${GALLERY_LABEL} ${index + 1}`,
    slotType: "gallery",
    url: "",
    width: 0,
    height: 0
  }));
}

function buildDefaultPhotoAngles() {
  return [
    {
      key: THREE_VIEW_KEY,
      label: THREE_VIEW_LABEL,
      slotType: "threeView",
      url: "",
      width: 0,
      height: 0
    },
    ...buildGallerySlots()
  ];
}

function pickPhotoFields(item) {
  if (!item || typeof item !== "object") {
    return { url: "", width: 0, height: 0, reviewStatus: undefined, rejectReason: undefined };
  }
  return {
    url: String(item.url || "").trim(),
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    reviewStatus: item.reviewStatus,
    rejectReason: item.rejectReason
  };
}

function mergePhotoAnglesFromServer(serverAngles) {
  const slots = buildDefaultPhotoAngles();
  const slotMap = new Map(slots.map((slot) => [slot.key, slot]));
  const list = Array.isArray(serverAngles) ? serverAngles : [];
  const legacyCarry = [];

  list.forEach((item) => {
    const key = String(item?.key || "").trim();
    const fields = pickPhotoFields(item);
    if (!fields.url) return;

    if (slotMap.has(key)) {
      const slot = slotMap.get(key);
      Object.assign(slot, fields);
      return;
    }

    legacyCarry.push(fields);
  });

  const threeView = slotMap.get(THREE_VIEW_KEY);
  const gallerySlots = slots.filter((slot) => slot.slotType === "gallery");
  let legacyIndex = 0;

  if (threeView && !threeView.url && legacyCarry.length) {
    Object.assign(threeView, legacyCarry[legacyIndex]);
    legacyIndex += 1;
  }

  for (let i = 0; i < gallerySlots.length && legacyIndex < legacyCarry.length; i += 1) {
    if (!gallerySlots[i].url) {
      Object.assign(gallerySlots[i], legacyCarry[legacyIndex]);
      legacyIndex += 1;
    }
  }

  return slots;
}

function isGallerySlot(item) {
  return item && item.slotType === "gallery";
}

function isThreeViewSlot(item) {
  return item && item.slotType === "threeView";
}

module.exports = {
  THREE_VIEW_KEY,
  GALLERY_MAX,
  GALLERY_MAX_PICK: GALLERY_MAX,
  THREE_VIEW_LABEL,
  GALLERY_LABEL,
  buildDefaultPhotoAngles,
  mergePhotoAnglesFromServer,
  isGallerySlot,
  isThreeViewSlot
};
