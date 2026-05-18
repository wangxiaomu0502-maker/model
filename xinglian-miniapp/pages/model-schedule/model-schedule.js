const STATUS_LIST = [
  { key: "available", label: "可接单", color: "#16a34a" },
  { key: "full", label: "已约满", color: "#dc2626" },
  { key: "rest", label: "休息", color: "#9ca3af" }
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(base, days) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function getEditableDateRange() {
  const today = new Date();
  const start = addDays(today, 1);
  const end = addDays(today, 30);
  return {
    startKey: formatDate(start),
    endKey: formatDate(end)
  };
}

Page({
  data: {
    mode: "month",
    statusList: STATUS_LIST,
    selectedStatus: "available",
    days: [],
    scheduleMap: {}
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

  async loadSchedule() {
    const days = this.buildDays({});
    this.setData({
      scheduleMap: {},
      days
    });

    try {
      const data = await this.requestWithAuth("/api/models/me", "GET");
      if (!data?.ok || !data.schedule) return;
      const remoteMap = data.schedule.scheduleMap || {};
      this.setData({
        scheduleMap: remoteMap,
        days: this.buildDays(remoteMap)
      });
    } catch (_error) {}
  },

  async onLoad() {
    await this.loadSchedule();
  },

  async onShow() {
    await this.loadSchedule();
  },

  buildDays(scheduleMap) {
    const today = new Date();
    const days = [];
    for (let i = 1; i <= 30; i += 1) {
      const date = addDays(today, i);
      const dateKey = formatDate(date);
      const status = scheduleMap[dateKey] || "rest";
      const week = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
      days.push({
        dateKey,
        day: date.getDate(),
        week,
        status
      });
    }
    return days;
  },

  sanitizeScheduleMap(rawMap) {
    const { startKey, endKey } = getEditableDateRange();
    const map = rawMap && typeof rawMap === "object" ? rawMap : {};
    const next = {};
    Object.keys(map).forEach((dateKey) => {
      if (dateKey >= startKey && dateKey <= endKey) {
        next[dateKey] = map[dateKey];
      }
    });
    return next;
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this.setData({ mode });
  },

  selectStatus(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.setData({
      selectedStatus: key
    });
  },

  setDayStatus(e) {
    const dateKey = e.currentTarget.dataset.date;
    if (!dateKey) return;
    const selectedStatus = this.data.selectedStatus;
    const scheduleMap = this.sanitizeScheduleMap({
      ...this.data.scheduleMap,
      [dateKey]: selectedStatus
    });
    const days = this.buildDays(scheduleMap);
    this.setData({ scheduleMap, days }, () => {
      this.requestWithAuth("/api/models/schedule", "PUT", { scheduleMap }).catch(() => {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      });
    });
  },
});
