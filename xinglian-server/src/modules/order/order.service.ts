import crypto from "crypto";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { assertMerchantPlatformContractSigned } from "../user/user.service";
import {
  findUserProfileById,
  resolveAgentUserIdForModel,
  resolveBrokerUserIdForMerchant
} from "../user/user.repository";
import { enqueueOrderForCs } from "../admin-cs-order/admin-cs-order.repository";
import {
  findSplitRulesByServiceType,
  insertDefaultSplitRulesRow,
  normalizeSplitServiceType
} from "../admin/split-rules.repository";
import { buildSplitRulesSnapshotJson } from "../split/order-split-rules-snapshot";
import { assertMerchantOrderEnabled } from "../system-settings/system-settings.service";
import { getModelPublicDetail } from "../model/model.service";
import {
  cancelUnpaidAwaitingPaymentOrder,
  countOrdersForParticipant,
  findOrderDetailRowById,
  findOrderHeaderById,
  findOrdersForParticipant,
  insertOrder,
  markOrderPaidByOrderNo,
  markOrderRefundFinished,
  markOrderRefunding,
  OrderDurationKindDb,
  OrderListRow,
  restoreOrderAfterRefundFailure,
  updateOrderStatus,
  updateOrderStatusAndRemark,
  updateOrderToCompletedWithSplitParties
} from "./order.repository";
import { resolveOrderCsContactForApp, type OrderCsContactDto } from "./order-cs-contact.service";
import {
  closeWechatOrder,
  createJsapiPrepay,
  createWechatRefund,
  isWechatPayConfigured,
  queryWechatOrderByOutTradeNo,
  queryWechatRefundByOutRefundNo
} from "../../integrations/wechat/pay/wechat-pay.client";
import { findOpenidByUserId } from "../auth/auth.repository";
import { durationKindLabel, OrderStatus, orderStatusLabel, paymentStatusLabel } from "./order-status";
import { CreateOrderDto, ListMineOrdersQuery, QuoteDto } from "./order.types";

/** 首期平台费比例，接入计费后可改为配置 */
const DEFAULT_PLATFORM_FEE_RATE = 0;

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function assertBookingWindow(bookingDate: string): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = new Date(today);
  first.setDate(first.getDate() + 1);
  const last = new Date(today);
  last.setDate(last.getDate() + 30);
  const minKey = formatDateKey(first);
  const maxKey = formatDateKey(last);
  if (bookingDate < minKey || bookingDate > maxKey) {
    throw new AppError("预约日期不在允许范围内", 400, ErrorCodes.VALIDATION_ERROR);
  }
}

function genOrderNo(): string {
  const t = Date.now().toString(36).toUpperCase().replace(/\./g, "");
  const r = crypto.randomBytes(4).toString("hex").toUpperCase();
  const raw = `XO${t}${r}`;
  return raw.slice(0, 32);
}

export function calculateOrderQuote(input: QuoteDto): {
  amount: number;
  platformFee: number;
  payableAmount: number;
} {
  const amount = Number((input.durationHours * input.unitPrice).toFixed(2));
  const platformFee = Number((amount * input.platformFeeRate).toFixed(2));
  const payableAmount = Number((amount + platformFee).toFixed(2));

  return {
    amount,
    platformFee,
    payableAmount
  };
}

function mapDurationKind(kind: CreateOrderDto["durationKind"]): OrderDurationKindDb {
  if (kind === "fullDay") return "full_day";
  if (kind === "halfDay") return "half_day";
  return "hourly";
}

/** 与下单入参一致：库表 full_day → API fullDay */
function durationKindDbToApi(
  db: string
): "fullDay" | "halfDay" | "hourly" {
  if (db === "full_day") return "fullDay";
  if (db === "half_day") return "halfDay";
  return "hourly";
}

function serviceTypeLabel(serviceType: string): string {
  return serviceType === "agent" ? "代理服务（提供影棚）" : "普通服务";
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function yuanToFen(v: unknown): number {
  return Math.round(num(v) * 100);
}

function buildOrderRefundNo(orderNo: string): string {
  return `RF${orderNo}`.slice(0, 64);
}

function buildMerchantOrderRemark(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  return text ? `商家备注：${text}` : null;
}

function paymentStatusFromRefundStatus(status: string): 2 | 3 | 4 {
  const normalized = status.toUpperCase();
  if (normalized === "SUCCESS") return 3;
  if (normalized === "ABNORMAL" || normalized === "CLOSED" || normalized === "FAILED") return 4;
  return 2;
}

function isoDateOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length ? s : null;
}

function listItemDto(row: OrderListRow, viewerRole: number) {
  const bd = isoDateOrNull(row.booking_date as Date | string);
  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: bd ? bd.slice(0, 10) : "",
    durationKind: durationKindDbToApi(String(row.duration_kind || "")),
    durationKindText: durationKindLabel(row.duration_kind),
    serviceType: normalizeSplitServiceType(row.service_type),
    serviceTypeText: serviceTypeLabel(String(row.service_type || "")),
    hourCount: row.hour_count,
    payableAmount: num(row.payable_amount),
    orderStatus: row.order_status,
    orderStatusText: orderStatusLabel(row.order_status),
    paymentStatus: row.payment_status,
    paymentStatusText: paymentStatusLabel(row.payment_status),
    createdAt: isoDateOrNull(row.created_at as Date | string),
    counterpart: {
      userNo: row.counterpart_user_no ?? "",
      nickname: row.counterpart_nickname ?? "",
      roleLabel: viewerRole === 2 ? "模特" : "商家"
    }
  };
}

export async function listMineOrders(
  userId: number,
  viewerRole: number,
  query: ListMineOrdersQuery
): Promise<{
  list: ReturnType<typeof listItemDto>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  if (viewerRole !== 1 && viewerRole !== 2) {
    throw new AppError("仅商家或模特可查看订单列表", 403, ErrorCodes.FORBIDDEN);
  }
  const side = viewerRole === 2 ? "merchant" : "model";
  const page = query.page;
  const pageSize = query.pageSize;
  const offset = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    countOrdersForParticipant({ userId, side, status: query.status }),
    findOrdersForParticipant({
      userId,
      side,
      status: query.status,
      limit: pageSize,
      offset
    })
  ]);
  return {
    list: rows.map((r) => listItemDto(r, viewerRole)),
    total,
    page,
    pageSize
  };
}

export async function getMineOrderDetail(
  orderId: number,
  userId: number,
  viewerRole: number
): Promise<{
  orderId: number;
  orderNo: string;
  bookingDate: string;
  durationKind: string;
  durationKindText: string;
  serviceType: string;
  serviceTypeText: string;
  hourCount: number | null;
  unitPriceSnapshot: number;
  serviceAmount: number;
  platformFee: number;
  payableAmount: number;
  paymentStatus: number;
  paymentStatusText: string;
  paymentChannel: string | null;
  paidAt: string | null;
  orderStatus: number;
  orderStatusText: string;
  remark: string;
  createdAt: string | null;
  updatedAt: string | null;
  merchant: { userNo: string; nickname: string };
  model: { userNo: string; nickname: string };
  viewerRole: number;
  actions: {
    modelConfirmAccept: boolean;
    modelConfirmService: boolean;
    modelCancel: boolean;
    merchantConfirmComplete: boolean;
    merchantCancel: boolean;
    merchantPay: boolean;
  };
  csContact: OrderCsContactDto | null;
  paymentMode: "mock" | "wechat";
}> {
  if (viewerRole !== 1 && viewerRole !== 2) {
    throw new AppError("无权查看订单", 403, ErrorCodes.FORBIDDEN);
  }
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const mid = Number(row.merchant_user_id);
  const moid = Number(row.model_user_id);
  if (userId !== mid && userId !== moid) {
    throw new AppError("无权查看该订单", 403, ErrorCodes.FORBIDDEN);
  }
  const st = Number(row.order_status);
  const bd = isoDateOrNull(row.booking_date as Date | string);
  const csContact = await resolveOrderCsContactForApp(orderId);
  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: bd ? bd.slice(0, 10) : "",
    durationKind: durationKindDbToApi(String(row.duration_kind || "")),
    durationKindText: durationKindLabel(row.duration_kind),
    serviceType: normalizeSplitServiceType(row.service_type),
    serviceTypeText: serviceTypeLabel(String(row.service_type || "")),
    hourCount: row.hour_count,
    unitPriceSnapshot: num(row.unit_price_snapshot),
    serviceAmount: num(row.service_amount),
    platformFee: num(row.platform_fee),
    payableAmount: num(row.payable_amount),
    paymentStatus: row.payment_status,
    paymentStatusText: paymentStatusLabel(row.payment_status),
    paymentChannel: row.payment_channel,
    paidAt: isoDateOrNull(row.paid_at as Date | string | null),
    orderStatus: st,
    orderStatusText: orderStatusLabel(st),
    remark: row.remark ?? "",
    createdAt: isoDateOrNull(row.created_at as Date | string),
    updatedAt: isoDateOrNull(row.updated_at as Date | string),
    merchant: {
      userNo: row.merchant_user_no ?? "",
      nickname: row.merchant_nickname ?? ""
    },
    model: {
      userNo: row.model_user_no ?? "",
      nickname: row.model_nickname ?? ""
    },
    viewerRole,
    actions: {
      modelConfirmAccept:
        viewerRole === 1 && st === OrderStatus.PENDING_MODEL_ACCEPT && Number(row.payment_status) === 1,
      modelConfirmService: viewerRole === 1 && st === OrderStatus.IN_PROGRESS,
      modelCancel: viewerRole === 1 && st === OrderStatus.PENDING_MODEL_ACCEPT,
      merchantConfirmComplete: viewerRole === 2 && st === OrderStatus.MODEL_FINISHED,
      merchantCancel:
        viewerRole === 2 &&
        (st === OrderStatus.AWAITING_PAYMENT ||
          st === OrderStatus.PENDING_MODEL_ACCEPT ||
          st === OrderStatus.IN_PROGRESS),
      merchantPay:
        viewerRole === 2 &&
        Number(row.payment_status) === 0 &&
        (st === OrderStatus.AWAITING_PAYMENT || st === OrderStatus.PENDING_MODEL_ACCEPT)
    },
    csContact,
    paymentMode: isWechatPayConfigured() ? "wechat" : "mock"
  };
}

export async function createMerchantOrder(
  merchantUserId: number,
  merchantRole: number,
  body: CreateOrderDto
): Promise<{
  orderId: number;
  orderNo: string;
  payableAmount: number;
  paymentStatus: number;
  paymentChannel: string | null;
  orderStatus: number;
  paymentMode: "mock" | "wechat";
  needPay: boolean;
}> {
  if (merchantRole !== 2) {
    throw new AppError("仅商家可下单", 403, ErrorCodes.FORBIDDEN);
  }

  const merchant = await findUserProfileById(merchantUserId);
  if (!merchant || merchant.role !== 2) {
    throw new AppError("仅商家可下单", 403, ErrorCodes.FORBIDDEN);
  }
  await assertMerchantOrderEnabled();
  assertMerchantPlatformContractSigned(merchant);

  assertBookingWindow(body.bookingDate);

  const detail = await getModelPublicDetail({ userNo: body.modelUserNo }, { viewerRole: 2 });
  const modelUserId = detail.userId as number;
  if (modelUserId === merchantUserId) {
    throw new AppError("不能向本人下单", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const schedule = detail.schedule as { scheduleMap?: Record<string, string> } | undefined;
  const scheduleMap = schedule?.scheduleMap ?? {};
  if (scheduleMap[body.bookingDate] !== "available") {
    throw new AppError("该日期不可预约", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const price = detail.price as {
    hourly?: unknown;
    halfDay?: unknown;
    fullDay?: unknown;
  };

  let durationDb = mapDurationKind(body.durationKind);
  let hourCount: number | null = null;
  let unitPrice = 0;
  let serviceAmount = 0;

  if (body.durationKind === "fullDay") {
    const p = toNum(price.fullDay);
    if (p == null) {
      throw new AppError("模特未设置全天报价", 400, ErrorCodes.VALIDATION_ERROR);
    }
    unitPrice = p;
    serviceAmount = p;
  } else if (body.durationKind === "halfDay") {
    const p = toNum(price.halfDay);
    if (p == null) {
      throw new AppError("模特未设置半天报价", 400, ErrorCodes.VALIDATION_ERROR);
    }
    unitPrice = p;
    serviceAmount = p;
  } else {
    const p = toNum(price.hourly);
    if (p == null) {
      throw new AppError("模特未设置小时报价", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const h = body.hourCount as number;
    unitPrice = p;
    serviceAmount = Number((p * h).toFixed(2));
    hourCount = h;
  }

  const platformFee = Number((serviceAmount * DEFAULT_PLATFORM_FEE_RATE).toFixed(2));
  const payableAmount = Number((serviceAmount + platformFee).toFixed(2));

  const orderSettings = detail.orderSettings as { orderEnabled?: boolean } | undefined;
  if (orderSettings && orderSettings.orderEnabled === false) {
    throw new AppError("模特暂不接单", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const orderNo = genOrderNo();
  const useWechatPay = isWechatPayConfigured();

  const orderId = await insertOrder({
    orderNo,
    merchantUserId,
    modelUserId,
    serviceType: body.serviceType,
    bookingDate: body.bookingDate,
    durationKind: durationDb,
    hourCount,
    unitPriceSnapshot: unitPrice,
    serviceAmount,
    platformFee,
    payableAmount,
    paymentStatus: useWechatPay ? 0 : 1,
    paymentChannel: useWechatPay ? null : "mock",
    paidAt: useWechatPay ? null : new Date(),
    orderStatus: useWechatPay ? OrderStatus.AWAITING_PAYMENT : OrderStatus.PENDING_MODEL_ACCEPT,
    remark: buildMerchantOrderRemark(body.merchantRemark)
  });

  return {
    orderId,
    orderNo,
    payableAmount,
    paymentStatus: useWechatPay ? 0 : 1,
    paymentChannel: useWechatPay ? null : "mock",
    orderStatus: useWechatPay ? OrderStatus.AWAITING_PAYMENT : OrderStatus.PENDING_MODEL_ACCEPT,
    paymentMode: useWechatPay ? ("wechat" as const) : ("mock" as const),
    needPay: useWechatPay
  };
}

export async function createJsapiPrepayForOrder(
  orderId: number,
  merchantUserId: number
): Promise<{
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
}> {
  if (!isWechatPayConfigured()) {
    throw new AppError("微信支付未启用", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.merchant_user_id) !== merchantUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.payment_status) !== 0) {
    throw new AppError("订单已支付或不可支付", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const openid = await findOpenidByUserId(merchantUserId);
  if (!openid) {
    throw new AppError("未找到微信 openid，请重新登录小程序", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const payableYuan = Number(row.payable_amount);
  const totalFen = Math.round(payableYuan * 100);
  const modelName = row.model_nickname || row.model_user_no || "模特";
  const booking = String(row.booking_date).slice(0, 10);

  return createJsapiPrepay({
    description: `星链模库预约-${modelName}-${booking}`,
    outTradeNo: row.order_no,
    totalFen,
    payerOpenid: openid
  });
}

export async function syncWechatPaymentForOrder(
  orderId: number,
  merchantUserId: number
): Promise<{
  orderId: number;
  paymentStatus: number;
  orderStatus: number;
  tradeState: string;
}> {
  if (!isWechatPayConfigured()) {
    throw new AppError("微信支付未启用", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.merchant_user_id) !== merchantUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.payment_status) === 1) {
    return {
      orderId,
      paymentStatus: 1,
      orderStatus: Number(row.order_status),
      tradeState: "SUCCESS"
    };
  }
  if (Number(row.payment_status) !== 0) {
    return {
      orderId,
      paymentStatus: Number(row.payment_status),
      orderStatus: Number(row.order_status),
      tradeState: String(row.refund_status || "")
    };
  }

  const tx = await queryWechatOrderByOutTradeNo(row.order_no);
  const tradeState = tx.tradeState;

  if (tradeState === "SUCCESS") {
    const localTotalFen = yuanToFen(row.payable_amount);
    if (tx.totalFen != null && tx.totalFen !== localTotalFen) {
      throw new AppError("微信支付金额与订单金额不一致", 409, ErrorCodes.VALIDATION_ERROR);
    }
    const ok = await markOrderPaidByOrderNo(row.order_no, "wechat", tx.transactionId || null);
    if (!ok) {
      const latest = await findOrderDetailRowById(orderId);
      return {
        orderId,
        paymentStatus: Number(latest?.payment_status ?? row.payment_status),
        orderStatus: Number(latest?.order_status ?? row.order_status),
        tradeState
      };
    }
    return {
      orderId,
      paymentStatus: 1,
      orderStatus: OrderStatus.PENDING_MODEL_ACCEPT,
      tradeState
    };
  }

  if (tradeState === "CLOSED" || tradeState === "REVOKED") {
    const remark = mergeCancelRemarkTag(row.remark, "商家取消", "微信支付已关闭");
    await cancelUnpaidAwaitingPaymentOrder(orderId, remark);
    return {
      orderId,
      paymentStatus: 0,
      orderStatus: OrderStatus.CANCELLED,
      tradeState
    };
  }

  return {
    orderId,
    paymentStatus: Number(row.payment_status),
    orderStatus: Number(row.order_status),
    tradeState
  };
}

export async function confirmAcceptOrderByModel(
  orderId: number,
  modelUserId: number
): Promise<{ orderId: number; orderStatus: number }> {
  const row = await findOrderHeaderById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.model_user_id) !== modelUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.order_status) !== OrderStatus.PENDING_MODEL_ACCEPT) {
    throw new AppError("当前状态不可确认接单", 400, ErrorCodes.VALIDATION_ERROR);
  }
  await updateOrderStatus(orderId, OrderStatus.IN_PROGRESS);
  await enqueueOrderForCs(orderId);
  return { orderId, orderStatus: OrderStatus.IN_PROGRESS };
}

export async function confirmServiceByModel(
  orderId: number,
  modelUserId: number
): Promise<{ orderId: number; orderStatus: number }> {
  const row = await findOrderHeaderById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.model_user_id) !== modelUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.order_status) !== OrderStatus.IN_PROGRESS) {
    throw new AppError("当前状态不可确认服务完成", 400, ErrorCodes.VALIDATION_ERROR);
  }
  await updateOrderStatus(orderId, OrderStatus.MODEL_FINISHED);
  return { orderId, orderStatus: OrderStatus.MODEL_FINISHED };
}

export async function confirmOrderCompleteByMerchant(
  orderId: number,
  merchantUserId: number
): Promise<{ orderId: number; orderStatus: number }> {
  const row = await findOrderHeaderById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.merchant_user_id) !== merchantUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.order_status) !== OrderStatus.MODEL_FINISHED) {
    throw new AppError("当前状态不可确认服务完成", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const merchantUid = Number(row.merchant_user_id);
  const modelUid = Number(row.model_user_id);
  const [brokerUserId, agentUserId] = await Promise.all([
    resolveBrokerUserIdForMerchant(merchantUid),
    resolveAgentUserIdForModel(modelUid)
  ]);

  await insertDefaultSplitRulesRow();
  const serviceType = normalizeSplitServiceType(row.service_type);
  const rulesRow = await findSplitRulesByServiceType(serviceType);
  if (!rulesRow) {
    throw new AppError("分账规则不存在", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const splitRulesSnapshotJson = buildSplitRulesSnapshotJson(rulesRow);

  const ok = await updateOrderToCompletedWithSplitParties(
    orderId,
    brokerUserId,
    agentUserId,
    splitRulesSnapshotJson
  );
  if (!ok) {
    throw new AppError("当前状态不可确认服务完成", 400, ErrorCodes.VALIDATION_ERROR);
  }
  return { orderId, orderStatus: OrderStatus.COMPLETED };
}

async function refundPaidWechatOrderOnCancel(params: {
  row: Awaited<ReturnType<typeof findOrderDetailRowById>> & {};
  newRemark: string;
}): Promise<void> {
  const row = params.row;
  const totalFen = yuanToFen(row.payable_amount);
  if (totalFen < 1) {
    throw new AppError("订单金额无效，无法退款", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const previousOrderStatus = Number(row.order_status);
  const refundNo = row.refund_no || buildOrderRefundNo(row.order_no);
  const locked = await markOrderRefunding({
    orderId: Number(row.id),
    currentOrderStatus: previousOrderStatus,
    remark: params.newRemark,
    refundNo,
    refundAmount: totalFen / 100
  });
  if (!locked) {
    throw new AppError("订单状态已变化，请刷新后重试", 409, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const refund = await createWechatRefund({
      outTradeNo: row.order_no,
      transactionId: row.wechat_transaction_id,
      outRefundNo: refundNo,
      totalFen,
      refundFen: totalFen,
      reason: params.newRemark
    });
    const paymentStatus = paymentStatusFromRefundStatus(refund.status);
    const ok = await markOrderRefundFinished({
      orderId: Number(row.id),
      paymentStatus,
      wechatRefundId: refund.refundId,
      refundStatus: refund.status
    });
    if (!ok) {
      throw new AppError("更新退款状态失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  } catch (error) {
    await restoreOrderAfterRefundFailure({
      orderId: Number(row.id),
      previousOrderStatus,
      previousRemark: row.remark
    });
    throw error;
  }
}

async function cancelUnpaidWechatOrder(params: {
  orderId: number;
  orderNo: string;
  newRemark: string;
}): Promise<void> {
  if (isWechatPayConfigured()) {
    await closeWechatOrder(params.orderNo);
  }
  const ok = await cancelUnpaidAwaitingPaymentOrder(params.orderId, params.newRemark);
  if (!ok) {
    throw new AppError("订单状态已变化，请刷新后重试", 409, ErrorCodes.VALIDATION_ERROR);
  }
}

export async function syncWechatRefundForOrder(
  orderId: number,
  userId: number
): Promise<{
  orderId: number;
  paymentStatus: number;
  orderStatus: number;
  refundStatus: string;
}> {
  if (!isWechatPayConfigured()) {
    throw new AppError("微信支付未启用", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (userId !== Number(row.merchant_user_id) && userId !== Number(row.model_user_id)) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.payment_status) !== 2) {
    return {
      orderId,
      paymentStatus: Number(row.payment_status),
      orderStatus: Number(row.order_status),
      refundStatus: String(row.refund_status || "")
    };
  }
  if (!row.refund_no) {
    throw new AppError("订单缺少商户退款单号，无法同步退款状态", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const refund = await queryWechatRefundByOutRefundNo(row.refund_no);
  const paymentStatus = paymentStatusFromRefundStatus(refund.status);
  const ok = await markOrderRefundFinished({
    orderId,
    paymentStatus,
    wechatRefundId: refund.refundId,
    refundStatus: refund.status
  });
  if (!ok) {
    const latest = await findOrderDetailRowById(orderId);
    return {
      orderId,
      paymentStatus: Number(latest?.payment_status ?? row.payment_status),
      orderStatus: Number(latest?.order_status ?? row.order_status),
      refundStatus: String(latest?.refund_status || row.refund_status || "")
    };
  }

  return {
    orderId,
    paymentStatus,
    orderStatus: Number(row.order_status),
    refundStatus: refund.status
  };
}

export async function cancelOrderByMerchant(
  orderId: number,
  merchantUserId: number,
  reasonRaw: string
): Promise<{ orderId: number; orderStatus: number }> {
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.merchant_user_id) !== merchantUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  const st = Number(row.order_status);
  const paySt = Number(row.payment_status);
  if (paySt === 0 && st === OrderStatus.AWAITING_PAYMENT) {
    const newRemark = mergeCancelRemarkTag(row.remark, "商家取消", reasonRaw.trim() || "未支付取消");
    await cancelUnpaidWechatOrder({ orderId, orderNo: row.order_no, newRemark });
    return { orderId, orderStatus: OrderStatus.CANCELLED };
  }
  if (st !== OrderStatus.PENDING_MODEL_ACCEPT && st !== OrderStatus.IN_PROGRESS) {
    throw new AppError("当前状态不可取消", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const reason = reasonRaw.trim();
  if (reason.length < 2) {
    throw new AppError("请填写取消原因（至少2个字）", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (reason.length > 480) {
    throw new AppError("取消原因过长", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const newRemark = mergeCancelRemarkTag(row.remark, "商家取消", reason);
  if (paySt === 1 && String(row.payment_channel || "").toLowerCase() === "wechat") {
    await refundPaidWechatOrderOnCancel({ row, newRemark });
    return { orderId, orderStatus: OrderStatus.CANCELLED };
  }
  await updateOrderStatusAndRemark(orderId, OrderStatus.CANCELLED, newRemark);
  return { orderId, orderStatus: OrderStatus.CANCELLED };
}

const ORDER_REMARK_MAX = 500;

function mergeCancelRemarkTag(
  prev: string | null | undefined,
  tagLabel: "模特取消" | "商家取消",
  reason: string
): string {
  const line = `[${tagLabel}] ${reason.trim()}`;
  const base = (prev ?? "").trim();
  const merged = base ? `${base}\n${line}` : line;
  return merged.length <= ORDER_REMARK_MAX ? merged : merged.slice(0, ORDER_REMARK_MAX);
}

/** 模特在「待接单」状态取消订单，reason 必填，写入备注 */
export async function cancelOrderByModel(
  orderId: number,
  modelUserId: number,
  reasonRaw: string
): Promise<{ orderId: number; orderStatus: number }> {
  const row = await findOrderDetailRowById(orderId);
  if (!row) {
    throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(row.model_user_id) !== modelUserId) {
    throw new AppError("无权操作该订单", 403, ErrorCodes.FORBIDDEN);
  }
  if (Number(row.order_status) !== OrderStatus.PENDING_MODEL_ACCEPT) {
    throw new AppError("当前状态不可取消", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const reason = reasonRaw.trim();
  if (reason.length < 2) {
    throw new AppError("请填写取消原因（至少2个字）", 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (reason.length > 480) {
    throw new AppError("取消原因过长", 400, ErrorCodes.VALIDATION_ERROR);
  }
  const newRemark = mergeCancelRemarkTag(row.remark, "模特取消", reason);
  if (Number(row.payment_status) === 1 && String(row.payment_channel || "").toLowerCase() === "wechat") {
    await refundPaidWechatOrderOnCancel({ row, newRemark });
    return { orderId, orderStatus: OrderStatus.CANCELLED };
  }
  await updateOrderStatusAndRemark(orderId, OrderStatus.CANCELLED, newRemark);
  return { orderId, orderStatus: OrderStatus.CANCELLED };
}
