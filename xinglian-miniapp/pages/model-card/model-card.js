const PHOTO_ANGLES = [
  { key: "frontFull", label: "正面全身" },
  { key: "backFull", label: "背面全身" },
  { key: "leftFull", label: "左侧面全身" },
  { key: "rightFull", label: "右侧面全身" },
  { key: "halfFront", label: "半身正面" },
  { key: "faceCloseup", label: "面部特写" },
  { key: "dynamicFull", label: "全身动态" },
  { key: "bodyCurve", label: "三围展示" },
  { key: "bikiniLingerie", label: "比基尼/内衣" }
];

const MAX_PICK_COUNT = 9;

const MEASUREMENT_FIELDS = [
  "height",
  "weight",
  "bust",
  "waist",
  "hip",
  "shoulder",
  "armSpan",
  "legLength",
  "shoeSize"
];

const MEASURE_RANGES = {
  height: { min: 140, max: 210, unit: "cm" },
  weight: { min: 35, max: 100, unit: "kg" },
  bust: { min: 70, max: 120, unit: "cm" },
  waist: { min: 50, max: 100, unit: "cm" },
  hip: { min: 75, max: 120, unit: "cm" },
  shoulder: { min: 30, max: 60, unit: "cm" },
  armSpan: { min: 140, max: 220, unit: "cm" },
  legLength: { min: 60, max: 120, unit: "cm" },
  shoeSize: { min: 33, max: 45, unit: "码" }
};

const HAIR_COLOR_OPTIONS = ["黑色", "棕色", "深棕色", "浅棕色", "金色", "红棕色", "亚麻色", "其他"];
const SKIN_COLOR_OPTIONS = ["白皙", "自然肤色", "小麦色", "健康古铜", "深色", "其他"];

/** 新填/未保存时的合理默认（非各列表首项） */
const DEFAULT_MEASUREMENTS = {
  height: "168",
  weight: "48",
  bust: "84",
  waist: "62",
  hip: "90",
  shoulder: "40",
  armSpan: "168",
  legLength: "85",
  shoeSize: "37"
};
const DEFAULT_HAIR_COLOR = "黑色";
const DEFAULT_SKIN_COLOR = "自然肤色";

function buildRangeOptions(min, max) {
  const list = [];
  for (let i = min; i <= max; i += 1) {
    list.push(String(i));
  }
  return list;
}

function buildMeasureOptions() {
  const options = {};
  MEASUREMENT_FIELDS.forEach((field) => {
    const range = MEASURE_RANGES[field];
    options[field] = buildRangeOptions(range.min, range.max);
  });
  return options;
}

function valueToIndex(options, value) {
  const s = String(value ?? "").trim();
  if (!s) return -1;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n) || n <= 0) return -1;
  const key = String(n);
  const idx = options.indexOf(key);
  return idx >= 0 ? idx : -1;
}

function optionToIndex(options, value) {
  const s = String(value ?? "").trim();
  if (!s) return -1;
  const idx = options.indexOf(s);
  if (idx >= 0) return idx;
  const otherIdx = options.indexOf("其他");
  return otherIdx >= 0 ? otherIdx : -1;
}

function buildMeasureIndexes(measureOptions, measurements) {
  const indexes = {};
  MEASUREMENT_FIELDS.forEach((field) => {
    const idx = valueToIndex(measureOptions[field], measurements[field]);
    indexes[field] = idx >= 0 ? idx : valueToIndex(measureOptions[field], DEFAULT_MEASUREMENTS[field]);
  });
  return indexes;
}

function applyMeasurementDefaults(measurements) {
  const next = { ...measurements };
  MEASUREMENT_FIELDS.forEach((field) => {
    const raw = String(next[field] ?? "").trim();
    if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
      next[field] = DEFAULT_MEASUREMENTS[field];
    }
  });
  return next;
}

const MEASURE_OPTIONS = buildMeasureOptions();
const INITIAL_MEASUREMENTS = applyMeasurementDefaults({});

Page({
  data: {
    photoAngles: PHOTO_ANGLES.map((item) => ({ ...item, url: "", width: 0, height: 0 })),
    measurements: INITIAL_MEASUREMENTS,
    measureOptions: MEASURE_OPTIONS,
    measureIndexes: buildMeasureIndexes(MEASURE_OPTIONS, INITIAL_MEASUREMENTS),
    hairColor: DEFAULT_HAIR_COLOR,
    skinColor: DEFAULT_SKIN_COLOR,
    hairColorOptions: HAIR_COLOR_OPTIONS,
    skinColorOptions: SKIN_COLOR_OPTIONS,
    hairColorIndex: optionToIndex(HAIR_COLOR_OPTIONS, DEFAULT_HAIR_COLOR),
    skinColorIndex: optionToIndex(SKIN_COLOR_OPTIONS, DEFAULT_SKIN_COLOR)
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

  async onLoad() {
    try {
      const data = await this.requestWithAuth("/api/models/me", "GET");
      if (!data?.ok || !data.card) return;
      const card = data.card;
      const photos = card.photoAngles || [];
      const photoMap = {};
      photos.forEach((item) => {
        photoMap[item.key] = item;
      });
      const incomingMeasurements = card.measurements || this.data.measurements;
      const normalizedMeasurements = { ...this.data.measurements };
      MEASUREMENT_FIELDS.forEach((field) => {
        const raw = incomingMeasurements[field];
        const n = Number(raw);
        normalizedMeasurements[field] =
          Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : "";
      });
      const withDefaults = applyMeasurementDefaults(normalizedMeasurements);
      const hairColor = String(card.hairColor || "").trim() || DEFAULT_HAIR_COLOR;
      const skinColor = String(card.skinColor || "").trim() || DEFAULT_SKIN_COLOR;
      this.setData({
        photoAngles: PHOTO_ANGLES.map((item) => ({
          ...item,
          url: (photoMap[item.key] && photoMap[item.key].url) || "",
          width: (photoMap[item.key] && photoMap[item.key].width) || 0,
          height: (photoMap[item.key] && photoMap[item.key].height) || 0
        })),
        measurements: withDefaults,
        measureIndexes: buildMeasureIndexes(MEASURE_OPTIONS, withDefaults),
        hairColor,
        skinColor,
        hairColorIndex: optionToIndex(HAIR_COLOR_OPTIONS, hairColor),
        skinColorIndex: optionToIndex(SKIN_COLOR_OPTIONS, skinColor)
      });
    } catch (_error) {}
  },

  onMeasurePick(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    const index = Number(e.detail.value);
    const options = this.data.measureOptions[field] || [];
    const value = options[index] || "";
    this.setData({
      [`measurements.${field}`]: value,
      [`measureIndexes.${field}`]: index
    });
  },

  onHairColorPick(e) {
    const index = Number(e.detail.value);
    const value = HAIR_COLOR_OPTIONS[index] || "";
    this.setData({
      hairColorIndex: index,
      hairColor: value
    });
  },

  onSkinColorPick(e) {
    const index = Number(e.detail.value);
    const value = SKIN_COLOR_OPTIONS[index] || "";
    this.setData({
      skinColorIndex: index,
      skinColor: value
    });
  },

  uploadCardPhoto(file) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/models/card/upload`,
        filePath: file.tempFilePath,
        name: "file",
        header: {
          Authorization: `Bearer ${app.globalData.token || ""}`
        },
        success: (uploadRes) => {
          const status = uploadRes.statusCode;
          let body = {};
          try {
            body = JSON.parse(uploadRes.data || "{}");
          } catch (_err) {
            body = {};
          }
          if (status !== 200 || !body.ok || !body.url) {
            reject(new Error(body.message || `上传失败(${status})`));
            return;
          }
          resolve({
            url: body.url,
            width: file.width || 0,
            height: file.height || 0
          });
        },
        fail: () => reject(new Error("网络异常，上传失败"))
      });
    });
  },

  fillBatchPhotos(startKey, uploadedList) {
    const current = this.data.photoAngles || [];
    const startIndex = Math.max(0, current.findIndex((item) => item.key === startKey));
    const targetIndexes = [startIndex];
    current.forEach((item, index) => {
      if (index !== startIndex && !item.url && index > startIndex) targetIndexes.push(index);
    });
    current.forEach((item, index) => {
      if (index !== startIndex && !item.url && index < startIndex) targetIndexes.push(index);
    });

    const next = current.map((item) => ({ ...item }));
    uploadedList.forEach((uploaded, idx) => {
      const targetIndex = targetIndexes[idx];
      if (targetIndex == null) return;
      next[targetIndex] = {
        ...next[targetIndex],
        url: uploaded.url,
        width: uploaded.width,
        height: uploaded.height
      };
    });
    this.setData({ photoAngles: next });
  },

  chooseBatchPhotos() {
    const firstEmpty = (this.data.photoAngles || []).find((item) => !item.url);
    if (!firstEmpty) {
      wx.showToast({ title: "模卡照片已满", icon: "none" });
      return;
    }
    this.choosePhotoByKey(firstEmpty.key);
  },

  choosePhoto(e) {
    const key = e.currentTarget.dataset.key;
    this.choosePhotoByKey(key);
  },

  choosePhotoByKey(key) {
    if (!key) return;
    const current = this.data.photoAngles || [];
    const startIndex = current.findIndex((item) => item.key === key);
    const emptyCount = current.filter((item) => !item.url).length;
    const replaceExisting = startIndex >= 0 && current[startIndex] && current[startIndex].url ? 1 : 0;
    const pickCount = Math.min(MAX_PICK_COUNT, Math.max(1, emptyCount + replaceExisting));

    wx.chooseMedia({
      count: pickCount,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const files = (res.tempFiles || []).filter((file) => file && file.tempFilePath);
        if (!files.length) return;

        wx.showLoading({ title: "上传中...", mask: true });
        try {
          const uploadedList = [];
          for (const file of files.slice(0, pickCount)) {
            const uploaded = await this.uploadCardPhoto(file);
            uploadedList.push(uploaded);
          }
          this.fillBatchPhotos(key, uploadedList);
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

  getUploadedCount() {
    return this.data.photoAngles.filter((item) => !!item.url).length;
  },

  validateBeforeSave() {
    const uploadedCount = this.getUploadedCount();
    if (uploadedCount < 1) {
      return "请至少上传 1 张模卡照";
    }

    const invalidField = MEASUREMENT_FIELDS.find((field) => {
      const raw = String(this.data.measurements[field] ?? "").trim();
      if (!/^\d+$/.test(raw)) {
        return true;
      }
      const n = Number(raw);
      return !Number.isFinite(n) || n <= 0;
    });

    if (invalidField) {
      return "请完整选择身材数据";
    }

    if (!String(this.data.hairColor || "").trim()) {
      return "请选择发色";
    }
    if (!String(this.data.skinColor || "").trim()) {
      return "请选择肤色";
    }

    return "";
  },

  async saveModelCard() {
    const error = this.validateBeforeSave();
    if (error) {
      wx.showToast({
        title: error,
        icon: "none"
      });
      return;
    }

    try {
      const measurements = {};
      MEASUREMENT_FIELDS.forEach((field) => {
        measurements[field] = Number(this.data.measurements[field]);
      });
      const data = await this.requestWithAuth("/api/models/card", "PUT", {
        photoAngles: this.data.photoAngles,
        measurements,
        hairColor: String(this.data.hairColor || "").trim(),
        skinColor: String(this.data.skinColor || "").trim()
      });
      if (!data?.ok) {
        wx.showToast({ title: data?.message || "保存失败", icon: "none" });
        return;
      }
      wx.showToast({ title: "模卡已保存", icon: "success" });
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        });
      }, 500);
    } catch (_error) {
      wx.showToast({ title: "网络异常", icon: "none" });
    }
  }
});
