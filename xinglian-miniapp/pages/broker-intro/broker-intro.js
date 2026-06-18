/** 各地区占比（展示用虚拟分布，会按平台总数缩放） */
const REGION_WEIGHTS = [
  { name: "北京市", weight: 22 },
  { name: "上海市", weight: 18 },
  { name: "广东省", weight: 16 },
  { name: "浙江省", weight: 11 },
  { name: "江苏省", weight: 9 },
  { name: "四川省", weight: 7 },
  { name: "湖北省", weight: 6 },
  { name: "其他地区", weight: 11 }
];

const INTRO_POINTS = [
  {
    title: "连接模特与客户",
    desc: "经纪人负责推广平台、引荐客户注册，并在商单撮合中协助沟通与跟进。"
  },
  {
    title: "专业与兼职并行",
    desc: "平台支持专业经纪人（持证）与兼职经纪人两种身份，可按自身资源选择参与深度。"
  },
  {
    title: "推广即绑定",
    desc: "通过专属链接或二维码邀请客户注册，系统自动建立推荐关系，后续关联订单可追溯。"
  },
  {
    title: "数据透明可查",
    desc: "绑定客户、关联订单与收益在经纪人工作台集中展示，规则清晰、流程可查看。"
  }
];

const ETHICS_POINTS = [
  "如实介绍平台服务与费用，不夸大承诺、不误导客户或模特。",
  "尊重双方隐私，未经同意不泄露联系方式、档期与商业信息。",
  "推广过程合规守纪，不使用骚扰、欺诈等不当方式获客。",
  "商单跟进公正中立，遇到问题及时反馈平台，不私下截留或篡改约定。"
];

function buildRegionStats(total) {
  const base = Math.max(Number(total) || 0, 128);
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
    brokerCount: "--",
    regionStats: buildRegionStats(0),
    introPoints: INTRO_POINTS,
    ethicsPoints: ETHICS_POINTS
  },

  onLoad() {
    this.loadBrokerCount();
  },

  loadBrokerCount() {
    const app = getApp();
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/models/home-summary`,
      method: "GET",
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          this.applyBrokerCount(128);
          return;
        }
        this.applyBrokerCount(Number(body.brokerCount || 0));
      },
      fail: () => {
        this.applyBrokerCount(128);
      }
    });
  },

  applyBrokerCount(count) {
    const brokerCount = Math.max(Number(count) || 0, 0);
    this.setData({
      loading: false,
      brokerCount: brokerCount || "--",
      regionStats: buildRegionStats(brokerCount || 128)
    });
  }
});
