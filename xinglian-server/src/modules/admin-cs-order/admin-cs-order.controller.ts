import { NextFunction, Request, Response } from "express";

import { success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import {
  csOrderIdParamSchema,
  csOrderNoteBodySchema,
  csPendingOrderListQuerySchema
} from "./admin-cs-order.types";
import {
  addCsOrderNote,
  completeCsOrder,
  getCsPendingOrderDetail,
  listCsPendingOrders,
  startCsOrder
} from "./admin-cs-order.service";

function requireCsAdminId(req: Request): number {
  const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
  if (!adminAuth?.adminUserId) {
    throw new Error("unauthorized");
  }
  return adminAuth.adminUserId;
}

export async function listPendingOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = csPendingOrderListQuerySchema.parse(req.query);
    const data = await listCsPendingOrders(query.page, query.pageSize, query.csStatus);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getPendingOrderDetailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orderId } = csOrderIdParamSchema.parse(req.params);
    const role = (req as AdminAuthenticatedRequest).adminAuth?.role;
    const readOnly = role === "admin";
    const data = await getCsPendingOrderDetail(orderId, readOnly);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function startPendingOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orderId } = csOrderIdParamSchema.parse(req.params);
    const adminUserId = requireCsAdminId(req);
    const data = await startCsOrder(orderId, adminUserId);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function completePendingOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orderId } = csOrderIdParamSchema.parse(req.params);
    const adminUserId = requireCsAdminId(req);
    const data = await completeCsOrder(orderId, adminUserId);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function addPendingOrderNoteHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orderId } = csOrderIdParamSchema.parse(req.params);
    const body = csOrderNoteBodySchema.parse(req.body);
    const adminUserId = requireCsAdminId(req);
    const data = await addCsOrderNote(orderId, adminUserId, body.content);
    success(res, data);
  } catch (error) {
    next(error);
  }
}
