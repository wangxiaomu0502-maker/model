import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { listMyMerchantsForBroker } from "./broker-bindings.service";
import { getBrokerDashboard } from "./broker-dashboard.service";
import { getBrokerRelatedOrderDetail, listBrokerRelatedOrders } from "./broker-order.service";
import { createBrokerPromoUrlLink, createBrokerPromoWxacode } from "./broker-promo.service";
import type { BrokerBoundListQuery, BrokerOrderListQuery } from "./broker.types";
import type { OrderIdParams } from "../order/order.types";

function assertBrokerRole(role: number | undefined): void {
  if (Number(role) !== 3 && Number(role) !== 4) {
    throw new AppError("仅经纪人或代理人可访问", 403, ErrorCodes.FORBIDDEN);
  }
}

export async function getBrokerDashboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    assertBrokerRole(auth.role);
    const data = await getBrokerDashboard(userId);
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function listMyMerchantsForBrokerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    assertBrokerRole(auth.role);
    const q = req.query as unknown as BrokerBoundListQuery;
    const payload = await listMyMerchantsForBroker(userId, q);
    success(res, payload);
  } catch (error) {
    next(error);
  }
}

export async function listBrokerOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    assertBrokerRole(auth.role);
    const q = req.query as unknown as BrokerOrderListQuery;
    const payload = await listBrokerRelatedOrders(userId, q);
    success(res, payload);
  } catch (error) {
    next(error);
  }
}

export async function getBrokerPromoUrlLinkController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    assertBrokerRole(auth.role);
    const payload = await createBrokerPromoUrlLink(userId, Number(auth.role));
    success(res, payload);
  } catch (error) {
    next(error);
  }
}

export async function getBrokerPromoQrcodeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    assertBrokerRole(auth.role);
    const payload = await createBrokerPromoWxacode(userId, Number(auth.role));
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Broker-User-No", payload.userNo);
    res.send(payload.buffer);
  } catch (error) {
    next(error);
  }
}

export async function getBrokerOrderDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    assertBrokerRole(auth.role);
    const { orderId } = req.params as unknown as OrderIdParams;
    const order = await getBrokerRelatedOrderDetail(orderId, userId);
    success(res, { order });
  } catch (error) {
    next(error);
  }
}
