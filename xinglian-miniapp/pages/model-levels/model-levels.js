const MODEL_LEVELS = [
  {
    code: "LV0",
    name: "初星模特",
    temperament: "刚被看见",
    requirement: "完成账号注册",
    intro: "适合刚加入平台的新模特，先完成身份建立和基础资料补充。",
    permissions: ["可进入平台建立身份", "可开始完善基础资料"],
    className: "model-level-card--lv0"
  },
  {
    code: "LV1",
    name: "新锐模特",
    temperament: "开始崭露头角",
    requirement: "完成基础模卡信息",
    intro: "资料开始具备展示价值，可用于基础模卡浏览和初步商拍匹配。",
    permissions: ["获得基础模卡展示", "可继续完善风格定位"],
    className: "model-level-card--lv1"
  },
  {
    code: "LV2",
    name: "风暴模特",
    temperament: "风格鲜明，有记忆点",
    requirement: "平台管理员手动升级",
    intro: "具备明确个人风格和镜头表现，更适合有具体风格要求的客户筛选。",
    permissions: ["展示个人风格定位", "提升列表识别度"],
    className: "model-level-card--lv2"
  },
  {
    code: "LV3",
    name: "星芒模特",
    temperament: "作品成型，具备展示力",
    requirement: "平台管理员手动升级",
    intro: "作品集和履历更完整，可承接更多商业展示、品牌拍摄和活动需求。",
    permissions: ["展示完整作品集", "更容易获得商家关注"],
    className: "model-level-card--lv3"
  },
  {
    code: "LV4",
    name: "皇冠模特",
    temperament: "平台认证，具备权威背书",
    requirement: "完成全部资料 + 平台管理员认证/授权",
    intro: "经过平台认证，适合对稳定性、履约能力和形象要求更高的商拍项目。",
    permissions: ["获得平台认证标识", "排序和推荐权重提升"],
    className: "model-level-card--lv4"
  },
  {
    code: "LV5",
    name: "天幕模特",
    temperament: "平台顶级优选，重点推荐",
    requirement: "完成全部资料 + 平台认证 + 平台优选/重点推荐",
    intro: "平台重点推荐模特，优先面向高价值商单、品牌项目和重点活动展示。",
    permissions: ["进入平台顶级优选池", "获得重点推荐曝光"],
    className: "model-level-card--lv5"
  }
];

Page({
  data: {
    modelLevels: MODEL_LEVELS
  }
});
