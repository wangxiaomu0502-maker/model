const HOME_SLOGAN = {
  lead: "星链相连",
  highlight: "模库机遇无限"
};

const HOME_MODEL_LEVELS = [
  { level: 5, shortCode: "LV5", shortName: "天幕", levelIndex: 1, className: "home-level-chip--lv5" },
  { level: 4, shortCode: "LV4", shortName: "皇冠", levelIndex: 2, className: "home-level-chip--lv4" },
  { level: 3, shortCode: "LV3", shortName: "星芒", levelIndex: 3, className: "home-level-chip--lv3" },
  { level: 2, shortCode: "LV2", shortName: "风暴", levelIndex: 4, className: "home-level-chip--lv2" },
  { level: 1, shortCode: "LV1", shortName: "新锐", levelIndex: 5, className: "home-level-chip--lv1" },
  { level: 0, shortCode: "LV0", shortName: "初星", levelIndex: 6, className: "home-level-chip--lv0" }
];

const HOME_MODEL_SKY_BADGE_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782809399839-x5a7857n.png";

const HOME_MODEL_SKY_NAME_BADGE_ICON =
  "https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/admin/assets/1/1782813438902-ua5sxv9g.png";

const HOME_BANNERS = [
  {
    id: "banner-1",
    title: "星链模库",
    subtitle: "连接优质模特与商拍需求",
    theme: "pink"
  },
  {
    id: "banner-2",
    title: "皇冠 · 天幕优选",
    subtitle: "平台认证模特，重点推荐曝光",
    theme: "violet"
  },
  {
    id: "banner-3",
    title: "商拍中心",
    subtitle: "精选场地套餐，一键预约",
    theme: "cyan"
  }
];

function applyModelLevelFilter(app, levelItem) {
  if (!levelItem || !app) return;
  app.globalData.pendingModelListFilter = {
    levelIndex: levelItem.levelIndex,
    categoryLabel: `${levelItem.shortCode} ${levelItem.shortName}`,
    ts: Date.now()
  };
}

module.exports = {
  HOME_SLOGAN,
  HOME_MODEL_LEVELS,
  HOME_MODEL_SKY_BADGE_ICON,
  HOME_MODEL_SKY_NAME_BADGE_ICON,
  HOME_BANNERS,
  applyModelLevelFilter
};
