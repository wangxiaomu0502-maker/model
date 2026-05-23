import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { durationKindLabel, orderStatusLabel } from "../order/order-status";
import { csOrderStatusLabel } from "../order/order-cs-status";

import {
  completeCsOrderProcessing,
  countCsOrdersForAdmin,
  findCsOrderByIdForAdmin,
  findCsOrderNotes,
  findCsOrdersPageForAdmin,
  insertCsOrderNote,
  startCsOrderProcessing
} from "./admin-cs-order.repository";

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toDateKey(v: Date | string): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function mapListRow(row: Awaited<ReturnType<typeof findCsOrdersPageForAdmin>>[number]) {
  const csStatus = Number(row.cs_status);
  return {
    orderId: row.id,
    orderNo: row.order_no,
    bookingDate: toDateKey(row.booking_date),
    durationKind: row.duration_kind,
    durationKindText: durationKindLabel(row.duration_kind),
    hourCount: row.hour_count != null ? Number(row.hour_count) : null,
    payableAmount: Number(row.payable_amount),
    orderStatus: Number(row.order_status),
    orderStatusText: orderStatusLabel(Number(row.order_status)),
    csStatus,
    csStatusText: csOrderStatusLabel(csStatus),
    csQueuedAt: toIso(row.cs_queued_at),
    csStartedAt: toIso(row.cs_started_at),
    csCompletedAt: toIso(row.cs_completed_at),
    merchantUserNo: row.merchant_user_no ?? "",
    merchantNickname: row.merchant_nickname ?? "",
    modelUserNo: row.model_user_no ?? "",
    modelNickname: row.model_nickname ?? "",
    noteCount: Number(row.note_count ?? 0)
  };
}

export type CsOrderPartyDto = {
  role: "merchant" | "model" | "broker" | "agent";
  roleLabel: string;
  userId: number | null;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName: string | null;
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapParty(
  role: CsOrderPartyDto["role"],
  roleLabel: string,
  userId: number | null | undefined,
  userNo: string | null | undefined,
  nickname: string | null | undefined,
  realName: string | null | undefined,
  phone: string | null | undefined,
  companyName?: string | null | undefined
): CsOrderPartyDto {
  return {
    role,
    roleLabel,
    userId: numOrNull(userId),
    userNo: strOrNull(userNo),
    nickname: strOrNull(nickname),
    realName: strOrNull(realName),
    phone: strOrNull(phone),
    companyName: strOrNull(companyName)
  };
}

function buildPartiesFromDetailRow(
  row: NonNullable<Awaited<ReturnType<typeof findCsOrderByIdForAdmin>>>
): CsOrderPartyDto[] {
  const parties: CsOrderPartyDto[] = [
    mapParty(
      "merchant",
      "商家",
      row.merchant_user_id,
      row.merchant_user_no,
      row.merchant_nickname,
      null,
      row.merchant_phone
    ),
    mapParty(
      "model",
      "模特",
      row.model_user_id,
      row.model_user_no,
      row.model_nickname,
      null,
      row.model_phone
    )
  ];
  parties.push(
    mapParty(
      "broker",
      "经纪人",
      numOrNull(row.resolved_broker_user_id),
      row.broker_user_no,
      row.broker_nickname,
      row.broker_real_name,
      row.broker_phone
    )
  );
  parties.push(
    mapParty(
      "agent",
      "代理人",
      numOrNull(row.resolved_agent_user_id),
      row.agent_user_no,
      row.agent_nickname,
      row.agent_real_name,
      row.agent_phone,
      row.agent_company_name
    )
  );
  return parties;
}

function mapNoteRow(row: Awaited<ReturnType<typeof findCsOrderNotes>>[number]) {
  return {
    id: row.id,
    orderId: row.order_id,
    adminUserId: row.admin_user_id,
    adminUsername: row.admin_username ?? "",
    adminDisplayName: row.admin_display_name,
    content: row.content,
    createdAt: toIso(row.created_at) ?? ""
  };
}

export async function listCsPendingOrders(
  page: number,
  pageSize: number,
  csStatus?: number
) {
  const total = await countCsOrdersForAdmin(csStatus);
  const offset = (page - 1) * pageSize;
  const rows = await findCsOrdersPageForAdmin(offset, pageSize, csStatus);
  return {
    total,
    page,
    pageSize,
    list: rows.map(mapListRow)
  };
}

export async function getCsPendingOrderDetail(orderId: number, readOnly = false) {
  const row = await findCsOrderByIdForAdmin(orderId);
  if (!row) {
    throw new AppError("订单不存在或未进入客服队列", 404, ErrorCodes.NOT_FOUND);
  }
  const notes = await findCsOrderNotes(orderId);
  const csStatus = Number(row.cs_status);
  const canOperate = !readOnly;
  return {
    ...mapListRow(row),
    serviceAmount: Number(row.service_amount),
    platformFee: Number(row.platform_fee),
    paymentStatus: Number(row.payment_status),
    paidAt: toIso(row.paid_at),
    createdAt: toIso(row.created_at) ?? "",
    handlerUsername: row.handler_username,
    handlerDisplayName: row.handler_display_name,
    notes: notes.map(mapNoteRow),
    parties: buildPartiesFromDetailRow(row),
    readOnly,
    actions: {
      canStart: canOperate && csStatus === 1,
      canComplete: canOperate && csStatus === 2,
      canAddNote: canOperate && (csStatus === 1 || csStatus === 2 || csStatus === 3)
    }
  };
}

export async function startCsOrder(orderId: number, adminUserId: number) {
  const ok = await startCsOrderProcessing(orderId, adminUserId);
  if (!ok) {
    throw new AppError("当前状态不可开始处理", 400, ErrorCodes.VALIDATION_ERROR);
  }
  return getCsPendingOrderDetail(orderId);
}

export async function completeCsOrder(orderId: number, adminUserId: number) {
  const ok = await completeCsOrderProcessing(orderId, adminUserId);
  if (!ok) {
    throw new AppError("当前状态不可标记完成", 400, ErrorCodes.VALIDATION_ERROR);
  }
  return getCsPendingOrderDetail(orderId);
}

export async function addCsOrderNote(
  orderId: number,
  adminUserId: number,
  content: string
) {
  const row = await findCsOrderByIdForAdmin(orderId);
  if (!row) {
    throw new AppError("订单不存在或未进入客服队列", 404, ErrorCodes.NOT_FOUND);
  }
  const noteId = await insertCsOrderNote(orderId, adminUserId, content.trim());
  const notes = await findCsOrderNotes(orderId);
  const created = notes.find((n) => n.id === noteId);
  if (!created) {
    throw new AppError("备注保存失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return mapNoteRow(created);
}
