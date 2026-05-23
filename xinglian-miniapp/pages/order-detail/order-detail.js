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
    { 0: "未支付", 1: "已支付", 2: "退款中", 3: "已退款", 4: "退款失败" }[o.paymentStatus] ||
    `支付${o.paymentStatus}`;
  return Object.assign({}, o, {
    paymentStatusText: payText,
    paidAtDisplay: fmtCn(o.paidAt),
    createdAtDisplay: fmtCn(o.createdAt),
    updatedAtDisplay: fmtCn(o.updatedAt),
    splitCalculatedAtDisplay: fmtCn(o.splitCalculatedAt),
    paymentChannelLabel: channelLabel(o.paymentChannel),
    remarkDisplay: o.remark && String(o.remark).trim() ? String(o.remark).trim() : "无",
    csContact: o.csContact && o.csContact.visible ? o.csContact : null
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
    syncPayChecked: false,
    syncRefundChecked: false,
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
          a.merchantCancel ||
          a.merchantPay
        );
        const bottomBarDual =
          !!(a.modelConfirmAccept && a.modelCancel) &&
          !(a.modelConfirmService || a.merchantConfirmComplete || a.merchantCancel);
        this.setData({ order: o, showActions, bottomBarDual });
        if (
          !brokerView &&
          !this.data.syncPayChecked &&
          Number(o.paymentStatus) === 0 &&
          o.actions?.merchantPay
        ) {
          this.setData({ syncPayChecked: true });
          void this.syncOrderPayment({ silent: true });
        }
        if (!brokerView && !this.data.syncRefundChecked && Number(o.paymentStatus) === 2) {
          this.setData({ syncRefundChecked: true });
          void this.syncOrderRefund({ silent: true });
        }
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

  cancelOrderAfterPaymentCancel() {
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    return new Promise((resolve) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/orders/${id}/cancel`,
        method: "POST",
        data: { reason: "用户取消支付" },
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`
        },
        success: (res) => resolve(res.statusCode >= 200 && res.statusCode < 300 && !!res.data?.ok),
        fail: () => resolve(false)
      });
    });
  },

  syncOrderPayment(options) {
    const silent = !!(options && options.silent);
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    return new Promise((resolve) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/orders/${id}/sync-pay`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`
        },
        success: (res) => {
          const d = res.data || {};
          const paid = res.statusCode >= 200 && res.statusCode < 300 && d.ok && Number(d.paymentStatus) === 1;
          if (paid) {
            if (!silent) wx.showToast({ title: "支付成功", icon: "success" });
            this.loadDetail();
          }
          resolve(d);
        },
        fail: () => resolve(null)
      });
    });
  },

  syncOrderRefund(options) {
    const silent = !!(options && options.silent);
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    return new Promise((resolve) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/orders/${id}/sync-refund`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`
        },
        success: (res) => {
          const d = res.data || {};
          const changed =
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            d.ok &&
            (Number(d.paymentStatus) === 3 || Number(d.paymentStatus) === 4);
          if (changed) {
            if (!silent) wx.showToast({ title: Number(d.paymentStatus) === 3 ? "退款成功" : "退款失败", icon: "none" });
            this.loadDetail();
          }
          resolve(d);
        },
        fail: () => resolve(null)
      });
    });
  },

  async requestWechatPay() {
    if (this.data.acting) return;
    const app = getApp();
    const token = app.globalData.token;
    const id = this.data.orderId;
    this.setData({ acting: true });
    wx.showLoading({ title: "调起支付", mask: true });
    try {
      const payRes = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.apiBaseUrl}/api/orders/${id}/pay`,
          method: "POST",
          header: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`
          },
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
            else reject(res.data || res);
          },
          fail: reject
        });
      });
      wx.hideLoading();
      if (!payRes?.ok || !payRes.payment) {
        wx.showToast({ title: payRes?.message || "获取支付参数失败", icon: "none" });
        return;
      }
      const p = payRes.payment;
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType || "RSA",
          paySign: p.paySign,
          success: resolve,
          fail: reject
        });
      });
      const synced = await this.syncOrderPayment();
      if (!synced || Number(synced.paymentStatus) !== 1) {
        wx.showToast({ title: "支付处理中", icon: "none" });
        this.loadDetail();
      }
    } catch (err) {
      wx.hideLoading();
      const msg = (err && err.errMsg) || (err && err.message) || "支付未完成";
      if (String(msg).indexOf("cancel") < 0 && String(msg).indexOf("取消") < 0) {
        wx.showToast({ title: String(msg), icon: "none" });
      } else {
        const closed = await this.cancelOrderAfterPaymentCancel();
        wx.showToast({ title: closed ? "已取消支付，订单已关闭" : "已取消支付", icon: "none" });
        this.loadDetail();
      }
    } finally {
      this.setData({ acting: false });
    }
  },

  onPayOrder() {
    wx.showModal({
      title: "微信支付",
      content: "确认使用微信支付完成该订单？",
      confirmText: "去支付",
      success: (r) => {
        if (r.confirm) void this.requestWechatPay();
      }
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

  onCallCs() {
    const phone = this.data.order && this.data.order.csContact && this.data.order.csContact.phone;
    if (!phone) {
      wx.showToast({ title: "暂无客服电话", icon: "none" });
      return;
    }
    wx.makePhoneCall({ phoneNumber: String(phone) });
  }

});
