/** 商单展示案例（首页/详情页共用展示数据） */
const BUSINESS_SHOWCASE_CASES = [
  {
    id: "case_1",
    customer: "北京轻奢女装客户",
    model: "鹿鹿 / 甜酷风",
    content: "新品短视频拍摄，半天档，需棚拍和外景各一组。",
    budget: "¥1800",
    status: "已匹配",
    city: "北京"
  },
  {
    id: "case_2",
    customer: "北京美妆品牌客户",
    model: "Mia / 高级脸",
    content: "直播间试妆展示，3 小时，要求镜头表现自然。",
    budget: "¥1200",
    status: "进行中",
    city: "北京"
  },
  {
    id: "case_3",
    customer: "北京车展客户",
    model: "小雅 / 礼仪模特",
    content: "展会站台 1 天，含品牌合影和引导接待。",
    budget: "¥2600",
    status: "待确认",
    city: "北京"
  },
  {
    id: "case_4",
    customer: "北京运动服饰客户",
    model: "阿夏 / 运动风",
    content: "跑步服新品图文拍摄，需动作表现和短视频花絮。",
    budget: "¥2200",
    status: "已匹配",
    city: "北京"
  },
  {
    id: "case_5",
    customer: "北京商业街客户",
    model: "Nana / 甜美风",
    content: "开业快闪活动 4 小时，现场互动和门店引流。",
    budget: "¥1500",
    status: "洽谈中",
    city: "北京"
  },
  {
    id: "case_6",
    customer: "北京摄影工作室",
    model: "可可 / 平面模特",
    content: "样片共创拍摄，妆造已定，需下午半天档期。",
    budget: "¥900",
    status: "新商单",
    city: "北京"
  }
];

const INTRO_POINTS = [
  {
    title: "实时动态展示",
    desc: "平台展示近期客户下单与模特匹配情况，帮助新用户了解真实合作场景。"
  },
  {
    title: "需求清晰透明",
    desc: "每条商单包含拍摄内容、预算区间与当前状态，便于快速判断合作类型。"
  },
  {
    title: "多方协同撮合",
    desc: "客户发起需求后，由平台与经纪人协助筛选模特、确认档期并完成履约。"
  }
];

const FLOW_STEPS = [
  { step: "01", title: "客户下单", desc: "描述拍摄/活动需求与预算" },
  { step: "02", title: "模特匹配", desc: "按风格、档期筛选合适人选" },
  { step: "03", title: "确认履约", desc: "约定时间地点，线上跟踪进度" },
  { step: "04", title: "完成结算", desc: "服务完成后按平台规则结算" }
];

const STATUS_THEME = {
  已匹配: "matched",
  进行中: "active",
  待确认: "pending",
  洽谈中: "talk",
  新商单: "new"
};

function statusThemeClass(status) {
  return STATUS_THEME[String(status || "").trim()] || "default";
}

function buildShowcaseCases(list = BUSINESS_SHOWCASE_CASES) {
  return list.map((item) => ({
    ...item,
    statusClass: statusThemeClass(item.status)
  }));
}

function buildShowcaseSummary(list = BUSINESS_SHOWCASE_CASES) {
  const arr = Array.isArray(list) ? list : [];
  return {
    total: arr.length,
    matched: arr.filter((item) => item.status === "已匹配").length,
    active: arr.filter((item) => item.status === "进行中" || item.status === "洽谈中").length
  };
}

function buildHomeBusinessTickerItems(list = BUSINESS_SHOWCASE_CASES) {
  return buildShowcaseCases(list).map((item) => ({
    id: item.id,
    status: item.status,
    statusClass: item.statusClass,
    line: `${item.customer} · ${item.model} · ${item.budget} · ${item.content}`
  }));
}

module.exports = {
  BUSINESS_SHOWCASE_CASES,
  INTRO_POINTS,
  FLOW_STEPS,
  buildShowcaseCases,
  buildShowcaseSummary,
  buildHomeBusinessTickerItems
};
