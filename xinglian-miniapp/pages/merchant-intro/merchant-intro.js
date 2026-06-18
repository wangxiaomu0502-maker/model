/** 各地区占比（展示用虚拟分布，会按平台总数缩放） */
const REGION_WEIGHTS = [
  { name: "北京市", weight: 24 },
  { name: "上海市", weight: 17 },
  { name: "广东省", weight: 18 },
  { name: "浙江省", weight: 12 },
  { name: "江苏省", weight: 10 },
  { name: "四川省", weight: 6 },
  { name: "福建省", weight: 5 },
  { name: "其他地区", weight: 8 }
];

const INTRO_POINTS = [
  {
    title: "浏览与筛选模特",
    desc: "按类型、地域、等级与风格标签快速浏览模卡，找到符合拍摄、活动或直播需求的模特。"
  },
  {
    title: "线上下单预约",
    desc: "发起商单、约定档期与费用，沟通记录与订单状态在平台内可追溯，减少反复确认成本。"
  },
  {
    title: "履约与结算保障",
    desc: "平台规则明确双方权责，支付、履约与结算流程透明，让合作更安心、更高效。"
  },
  {
    title: "延伸服务对接",
    desc: "可进一步对接商拍中心、培训计划等平台资源，满足品牌拍摄、形象升级等多元需求。"
  }
];

const ETHICS_POINTS = [
  "尊重模特劳动与时间，按约支付费用，不恶意压价、拖欠或临时变更关键约定。",
  "商单需求描述真实清晰，不提出违规、危险或不当拍摄要求。",
  "依法合规使用模特肖像与交付作品，不超出约定范围传播或商用。",
  "遇到问题优先通过平台沟通协调，共同维护良好合作环境。"
];

function buildRegionStats(total) {
  const base = Math.max(Number(total) || 0, 96);
  const sumWeight = REGION_WEIGHTS.reduce((s, item) => s + item.weight, 0);
  let assigned = 0;
  const list = REGION_WEIGHTS.map((item, index) => {
    let count =
      index === REGION_WEIGHTS.length - 1
        ? base - assigned
        : Math.round((base * item.weight) / sumWeight);
    assigned += count;
    const percent = Math.round((count / base) * 100);
    return {
      name: item.name,
      count,
      percent,
      barWidth: Math.max(percent, 6)
    };
  });
  return list.sort((a, b) => b.count - a.count);
}

Page({
  data: {
    loading: true,
    merchantCount: "--",
    regionStats: buildRegionStats(0),
    introPoints: INTRO_POINTS,
    ethicsPoints: ETHICS_POINTS
  },

  onLoad() {
    this.loadMerchantCount();
  },

  loadMerchantCount() {
    const app = getApp();
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/home-summary`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.applyMerchantCount(96);
          return;
        }
        this.applyMerchantCount(Number(body.merchantCount || 0));
      },
      fail: () => {
        this.applyMerchantCount(96);
      }
    });
  },

  applyMerchantCount(count) {
    const merchantCount = Math.max(Number(count) || 0, 0);
    this.setData({
      loading: false,
      merchantCount: merchantCount || "--",
      regionStats: buildRegionStats(merchantCount || 96)
    });
  }
});
