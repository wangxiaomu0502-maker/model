import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import {
  calculateOrderQuote,
  cancelOrderByMerchant,
  cancelOrderByModel,
  confirmAcceptOrderByModel,
  confirmOrderCompleteByMerchant,
  confirmServiceByModel,
  createJsapiPrepayForOrder,
  createMerchantOrder,
  getMineOrderDetail,
  listMineOrders,
  syncWechatRefundForOrder,
  syncWechatPaymentForOrder
} from "./order.service";
import {
  CreateOrderDto,
  ListMineOrdersQuery,
  OrderIdParams,
  QuoteDto
} from "./order.types";

export async function listMineOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const role = auth?.role ?? -1;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const q = req.query as unknown as ListMineOrdersQuery;
    const payload = await listMineOrders(userId, role, q);
    success(res, payload);
  } catch (error) {
    next(error);
  }
}

export async function getMineOrderDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const role = auth?.role ?? -1;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const detail = await getMineOrderDetail(orderId, userId, role);
    success(res, { order: detail });
  } catch (error) {
    next(error);
  }
}

export function quoteOrderController(req: Request, res: Response): void {
  const body = req.body as QuoteDto;
  const quote = calculateOrderQuote(body);
  success(res, {
    quote
  });
}

export async function createOrderController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const role = auth?.role ?? -1;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const body = req.body as CreateOrderDto;
    const order = await createMerchantOrder(userId, role, body);
    success(res, {
      order: {
        orderId: order.orderId,
        orderNo: order.orderNo,
        payableAmount: order.payableAmount,
        paymentStatus: order.paymentStatus,
        paymentChannel: order.paymentChannel,
        orderStatus: order.orderStatus,
        paymentMode: order.paymentMode,
        needPay: order.needPay
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function payOrderController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const payment = await createJsapiPrepayForOrder(orderId, userId);
    success(res, { payment });
  } catch (error) {
    next(error);
  }
}

export async function syncPayOrderController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const result = await syncWechatPaymentForOrder(orderId, userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function syncRefundOrderController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const result = await syncWechatRefundForOrder(orderId, userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function confirmAcceptController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const result = await confirmAcceptOrderByModel(orderId, userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function confirmServiceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const result = await confirmServiceByModel(orderId, userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function confirmOrderCompleteController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const result = await confirmOrderCompleteByMerchant(orderId, userId);
    success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function cancelOrderController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const role = auth?.role ?? -1;
    if (!userId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as OrderIdParams;
    const body = (req.body ?? {}) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason : "";
    let result: { orderId: number; orderStatus: number };
    if (role === 2) {
      result = await cancelOrderByMerchant(orderId, userId, reason);
    } else if (role === 1) {
      result = await cancelOrderByModel(orderId, userId, reason);
    } else {
      fail(req, res, 403, { code: ErrorCodes.FORBIDDEN, message: "无权取消订单" });
      return;
    }
    success(res, result);
  } catch (error) {
    next(error);
  }
}
