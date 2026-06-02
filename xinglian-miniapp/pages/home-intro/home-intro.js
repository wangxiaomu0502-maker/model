const { normalizeModelList, pickFeaturedModels } = require("../../utils/model-list-display.js");
const { buildLoadingShareAppMessage } = require("../../utils/loading-share.js");

const BUSINESS_CASES = [
  {
    id: "case_1",
    customer: "北京轻奢女装客户",
    model: "鹿鹿 / 甜酷风",
    content: "新品短视频拍摄，半天档，需棚拍和外景各一组。",
    budget: "¥1800",
    status: "已匹配"
  },
  {
    id: "case_2",
    customer: "北京美妆品牌客户",
    model: "Mia / 高级脸",
    content: "直播间试妆展示，3 小时，要求镜头表现自然。",
    budget: "¥1200",
    status: "进行中"
  },
  {
    id: "case_3",
    customer: "北京车展客户",
    model: "小雅 / 礼仪模特",
    content: "展会站台 1 天，含品牌合影和引导接待。",
    budget: "¥2600",
    status: "待确认"
  },
  {
    id: "case_4",
    customer: "北京运动服饰客户",
    model: "阿夏 / 运动风",
    content: "跑步服新品图文拍摄，需动作表现和短视频花絮。",
    budget: "¥2200",
    status: "已匹配"
  },
  {
    id: "case_5",
    customer: "北京商业街客户",
    model: "Nana / 甜美风",
    content: "开业快闪活动 4 小时，现场互动和门店引流。",
    budget: "¥1500",
    status: "洽谈中"
  },
  {
    id: "case_6",
    customer: "北京摄影工作室",
    model: "可可 / 平面模特",
    content: "样片共创拍摄，妆造已定，需下午半天档期。",
    budget: "¥900",
    status: "新商单"
  }
];

function buildBusinessSlides(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((_, index) => ({
    id: `slide_${index}`,
    list: [0, 1, 2].map((offset) => list[(index + offset) % list.length])
  }));
}

const MODEL_LEVEL_ENTRIES = [
  {
    level: 0,
    code: "LV0",
    name: "初星模特",
    temperament: "刚被看见",
    requirement: "完成账号注册",
    permissions: ["可进入平台建立身份", "可开始完善基础资料"],
    className: "home-level-card--lv0"
  },
  {
    level: 1,
    code: "LV1",
    name: "新锐模特",
    temperament: "开始崭露头角",
    requirement: "完成基础模卡信息",
    permissions: ["获得基础模卡展示", "可继续完善风格定位"],
    className: "home-level-card--lv1"
  },
  {
    level: 2,
    code: "LV2",
    name: "风暴模特",
    temperament: "风格鲜明，有记忆点",
    requirement: "平台管理员手动升级",
    permissions: ["展示个人风格定位", "提升列表识别度"],
    className: "home-level-card--lv2"
  },
  {
    level: 3,
    code: "LV3",
    name: "星芒模特",
    temperament: "作品成型，具备展示力",
    requirement: "平台管理员手动升级",
    permissions: ["展示完整作品集", "更容易获得商家关注"],
    className: "home-level-card--lv3"
  },
  {
    level: 4,
    code: "LV4",
    name: "皇冠模特",
    temperament: "平台认证，具备权威背书",
    requirement: "完成全部资料 + 平台管理员认证/授权",
    permissions: ["获得平台认证标识", "排序和推荐权重提升"],
    className: "home-level-card--lv4"
  },
  {
    level: 5,
    code: "LV5",
    name: "天幕模特",
    temperament: "平台顶级优选，重点推荐",
    requirement: "完成全部资料 + 平台认证 + 平台优选/重点推荐",
    permissions: ["进入平台顶级优选池", "获得重点推荐曝光"],
    className: "home-level-card--lv5"
  }
];

Page({
  data: {
    modelCount: "--",
    brokerCount: "--",
    merchantCount: "--",
    businessCases: BUSINESS_CASES,
    businessSlides: buildBusinessSlides(BUSINESS_CASES),
    modelLevelEntries: MODEL_LEVEL_ENTRIES,
    levelIntroVisible: false,
    selectedModelLevel: null,
    featuredModels: [],
    loading: false,
    loadError: ""
  },

  onLoad() {
    this.loadHomeData();
  },

  loadHomeData() {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    this.loadSummary(app);
    this.loadFeaturedModels(app);
  },

  loadSummary(app) {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/home-summary`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) return;
        this.setData({
          modelCount: Number(body.modelCount || 0),
          brokerCount: Number(body.brokerCount || 0),
          merchantCount: Number(body.merchantCount || 0)
        });
      }
    });
  },

  loadFeaturedModels(app) {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/list?limit=10`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.setData({ featuredModels: [], loadError: body.message || "首页内容加载失败" });
          return;
        }
        const featuredModels = pickFeaturedModels(normalizeModelList(body.list), 10);
        const patch = { featuredModels, loadError: "" };
        if (this.data.modelCount === "--") {
          patch.modelCount = featuredModels.length;
        }
        this.setData(patch);
      },
      fail: () => {
        this.setData({ featuredModels: [], loadError: "网络异常，首页内容加载失败" });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goRegister() {
    wx.navigateTo({
      url: "/pages/intro/intro"
    });
  },

  goModelListWithLogin() {
    const app = getApp();
    const token = app.globalData.token || wx.getStorageSync("authToken") || "";
    const role = Number(app.globalData.role || wx.getStorageSync("selectedRole") || 0);
    if (token && role > 0) {
      wx.switchTab({ url: "/pages/model-list/model-list" });
      return;
    }
    wx.showModal({
      title: "请先注册",
      content: "注册并选择身份后可查看模特列表。",
      confirmText: "去注册",
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: "/pages/intro/intro" });
        }
      }
    });
  },

  openLevelIntro(e) {
    const level = Number(e.currentTarget.dataset.level);
    const selected = MODEL_LEVEL_ENTRIES.find((item) => item.level === level);
    if (!selected) return;
    this.setData({
      selectedModelLevel: selected,
      levelIntroVisible: true
    });
  },

  closeLevelIntro() {
    this.setData({
      levelIntroVisible: false,
      selectedModelLevel: null
    });
  },

  preventLevelIntroBubble() {},

  goModelDetail(e) {
    const userNo = e.currentTarget.dataset.userNo || "";
    if (!userNo) return;
    wx.navigateTo({
      url: `/pages/model-detail/model-detail?userNo=${encodeURIComponent(userNo)}`
    });
  },

  goEntryPage(e) {
    const url = e.currentTarget.dataset.url || "";
    if (!url) return;
    wx.navigateTo({ url });
  },

  onShareAppMessage() {
    return buildLoadingShareAppMessage();
  }
});
