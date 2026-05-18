import crypto from "crypto";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { assertMerchantPlatformContractSigned } from "../user/user.service";
import {
  findUserProfileById,
  resolveAgentUserIdForModel,
  resolveBrokerUserIdForMerchant
} from "../user/user.repository";
import { findSplitRulesById, insertDefaultSplitRulesRow } from "../admin/split-rules.repository";
import { buildSplitRulesSnapshotJson } from "../split/order-split-rules-snapshot";
import { getModelPublicDetail } from "../model/model.service";
import {
  countOrdersForParticipant,
  findOrderDetailRowById,
  findOrderHeaderById,
  findOrdersForParticipant,
  insertOrder,
  OrderDurationKindDb,
  OrderListRow,
  updateOrderStatus,
  updateOrderStatusAndRemark,
  updateOrderToCompletedWithSplitParties
} from "./order.repository";
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

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  };
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
  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: bd ? bd.slice(0, 10) : "",
    durationKind: durationKindDbToApi(String(row.duration_kind || "")),
    durationKindText: durationKindLabel(row.duration_kind),
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
      modelConfirmAccept: viewerRole === 1 && st === OrderStatus.PENDING_MODEL_ACCEPT,
      modelConfirmService: viewerRole === 1 && st === OrderStatus.IN_PROGRESS,
      modelCancel: viewerRole === 1 && st === OrderStatus.PENDING_MODEL_ACCEPT,
      merchantConfirmComplete: viewerRole === 2 && st === OrderStatus.MODEL_FINISHED,
      merchantCancel:
        viewerRole === 2 &&
        (st === OrderStatus.PENDING_MODEL_ACCEPT || st === OrderStatus.IN_PROGRESS)
    }
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
}> {
  if (merchantRole !== 2) {
    throw new AppError("仅商家可下单", 403, ErrorCodes.FORBIDDEN);
  }

  const merchant = await findUserProfileById(merchantUserId);
  if (!merchant || merchant.role !== 2) {
    throw new AppError("仅商家可下单", 403, ErrorCodes.FORBIDDEN);
  }
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

  const paidAt = new Date();
  const orderNo = genOrderNo();

  const orderId = await insertOrder({
    orderNo,
    merchantUserId,
    modelUserId,
    bookingDate: body.bookingDate,
    durationKind: durationDb,
    hourCount,
    unitPriceSnapshot: unitPrice,
    serviceAmount,
    platformFee,
    payableAmount,
    paymentStatus: 1,
    paymentChannel: "mock",
    paidAt,
    orderStatus: OrderStatus.PENDING_MODEL_ACCEPT
  });

  return {
    orderId,
    orderNo,
    payableAmount,
    paymentStatus: 1,
    paymentChannel: "mock",
    orderStatus: OrderStatus.PENDING_MODEL_ACCEPT
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
  const rulesRow = await findSplitRulesById(1);
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
  await updateOrderStatusAndRemark(orderId, OrderStatus.CANCELLED, newRemark);
  return { orderId, orderStatus: OrderStatus.CANCELLED };
}
