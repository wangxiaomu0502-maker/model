function fmtCn(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function channelLabel(ch) {
  if (ch == null || String(ch).trim() === "") return "—";
  const c = String(ch).toLowerCase();
  if (c === "mock") return "模拟支付 (mock)";
  if (c === "wechat") return "微信支付";
  return String(ch);
}

/** 与后端 orders.order_status 一致：3 = 模特已完成，此时商家不应再取消 */
const ORDER_STATUS_MODEL_FINISHED = 3;

function enrichOrder(o) {
  if (!o) return null;
  const payText =
    o.paymentStatusText ||
    { 0: "未支付", 1: "已支付", 2: "退款中", 3: "已退款" }[o.paymentStatus] ||
    `支付${o.paymentStatus}`;
  return Object.assign({}, o, {
    paymentStatusText: payText,
    paidAtDisplay: fmtCn(o.paidAt),
    createdAtDisplay: fmtCn(o.createdAt),
    updatedAtDisplay: fmtCn(o.updatedAt),
    splitCalculatedAtDisplay: fmtCn(o.splitCalculatedAt),
    paymentChannelLabel: channelLabel(o.paymentChannel),
    remarkDisplay: o.remark && String(o.remark).trim() ? String(o.remark).trim() : "无"
  });
}

/** 兜底：旧接口仍返回 merchantCancel 时，按状态隐藏商家取消 */
function normalizeOrderActions(o) {
  if (!o || !o.actions) return o;
  const st = Number(o.orderStatus);
  const vr = Number(o.viewerRole);
  if (vr === 2 && st === ORDER_STATUS_MODEL_FINISHED && o.actions.merchantCancel) {
    return Object.assign({}, o, {
      actions: Object.assign({}, o.actions, { merchantCancel: false })
    });
  }
  return o;
}

Page({
  data: {
    orderId: 0,
    brokerView: false,
    order: null,
    loading: true,
    acting: false,
    showActions: false,
    bottomBarDual: false,
    showCancelReasonSheet: false,
    cancelReasonDraft: "",
    cancelReasonAudienceHint: ""
  },

  onLoad(options) {
    const id = Number(options.id || options.orderId || 0);
    if (!id) {
      wx.showToast({ title: "订单无效", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const brokerView = options.broker === "1" || options.broker === "true";
    this.setData({ orderId: id, brokerView }, () => this.loadDetail());
  },

  loadDetail() {
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    const brokerView = this.data.brokerView;
    if (!token || !id) return;
    this.setData({ loading: true });
    const apiPath = brokerView ? `/api/broker/orders/${id}` : `/api/orders/my/${id}`;
    wx.request({
      url: `${app.globalData.apiBaseUrl}${apiPath}`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const d = res.data || {};
        if (!d.ok || !d.order) {
          wx.showToast({ title: d.message || "加载失败", icon: "none" });
          return;
        }
        const o = normalizeOrderActions(enrichOrder(d.order));
        const a = o.actions || {};
        const showActions = !!(
          a.modelConfirmAccept ||
          a.modelConfirmService ||
          a.modelCancel ||
          a.merchantConfirmComplete ||
          a.merchantCancel
        );
        const bottomBarDual =
          !!(a.modelConfirmAccept && a.modelCancel) &&
          !(a.modelConfirmService || a.merchantConfirmComplete || a.merchantCancel);
        this.setData({ order: o, showActions, bottomBarDual });
      },
      fail: () => wx.showToast({ title: "网络异常", icon: "none" }),
      complete: () => this.setData({ loading: false })
    });
  },

  postAction(path, okMsg, payload) {
    if (this.data.acting) return;
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    this.setData({ acting: true });
    const data = payload && typeof payload === "object" ? payload : {};
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/orders/${id}/${path}`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data,
      success: (res) => {
        const d = res.data || {};
        if (!d.ok) {
          wx.showToast({ title: d.message || "操作失败", icon: "none" });
          return;
        }
        wx.showToast({ title: okMsg, icon: "success" });
        if (path === "confirm-accept") {
          try {
            const { syncPendingAcceptOrderBadge } = require("../../utils/pending-accept-order-badge.js");
            syncPendingAcceptOrderBadge({
              apiBaseUrl: app.globalData.apiBaseUrl,
              token: app.globalData.token || "",
              role: Number(app.globalData.role || 0)
            });
          } catch (_e) {}
        }
        this.setData({
          showCancelReasonSheet: false,
          cancelReasonDraft: "",
          cancelReasonAudienceHint: ""
        });
        this.loadDetail();
      },
      fail: () => wx.showToast({ title: "网络异常", icon: "none" }),
      complete: () => this.setData({ acting: false })
    });
  },

  onConfirmAccept() {
    wx.showModal({
      title: "确认接单",
      content: "接单后将进入进行中，请确认已核对档期与要求。是否确认接单？",
      confirmText: "确认接单",
      cancelText: "再想想",
      success: (r) => {
        if (r.confirm) this.postAction("confirm-accept", "已确认接单");
      }
    });
  },

  onConfirmService() {
    wx.showModal({
      title: "确认服务完成",
      content: "请确认本次服务已向商家交付完成。提交后将等待商家确认。是否继续？",
      confirmText: "确认完成",
      cancelText: "再想想",
      success: (r) => {
        if (r.confirm) this.postAction("confirm-service", "已提交完成");
      }
    });
  },

  onConfirmComplete() {
    wx.showModal({
      title: "确认服务完成",
      content: "确认即表示认可本次服务，订单将标记为已完成。是否继续？",
      confirmText: "确认完成",
      cancelText: "再想想",
      success: (r) => {
        if (r.confirm) this.postAction("confirm-complete", "已确认服务完成");
      }
    });
  },

  onOpenMerchantCancel() {
    const o = this.data.order;
    if (!o || o.viewerRole !== 2) return;
    this.setData({
      showCancelReasonSheet: true,
      cancelReasonDraft: "",
      cancelReasonAudienceHint: "至少 2 个字，将作为订单备注供对方（模特）查看"
    });
  },

  onOpenModelCancel() {
    const o = this.data.order;
    if (!o || o.viewerRole !== 1) return;
    this.setData({
      showCancelReasonSheet: true,
      cancelReasonDraft: "",
      cancelReasonAudienceHint: "至少 2 个字，将作为订单备注供对方（商家）查看"
    });
  },

  onCancelReasonInput(e) {
    this.setData({ cancelReasonDraft: (e.detail && e.detail.value) || "" });
  },

  stopTouchMove() {},

  preventCloseTap() {},

  closeCancelReasonSheet() {
    if (this.data.acting) return;
    this.setData({
      showCancelReasonSheet: false,
      cancelReasonDraft: "",
      cancelReasonAudienceHint: ""
    });
  },

  submitCancelWithReason() {
    const reason = (this.data.cancelReasonDraft || "").trim();
    if (reason.length < 2) {
      wx.showToast({ title: "请填写取消原因（至少2个字）", icon: "none" });
      return;
    }
    const vr = this.data.order ? this.data.order.viewerRole : 0;
    const content =
      vr === 1
        ? "提交后订单将关闭，对方（商家）可在订单备注中查看取消原因。是否确认？"
        : "提交后订单将关闭，对方（模特）可在订单备注中查看取消原因。是否确认？";
    wx.showModal({
      title: "确认取消订单",
      content,
      confirmText: "确认取消",
      cancelText: "再想想",
      success: (r) => {
        if (r.confirm) this.postAction("cancel", "已取消", { reason });
      }
    });
  },

});
