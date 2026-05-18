import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  cancelOrderController,
  confirmAcceptController,
  confirmOrderCompleteController,
  confirmServiceController,
  createOrderController,
  getMineOrderDetailController,
  listMineOrdersController,
  quoteOrderController
} from "./order.controller";
import {
  createOrderSchema,
  cancelOrderBodySchema,
  listMineOrdersQuerySchema,
  orderIdParamSchema,
  quoteSchema
} from "./order.types";

const orderRouter = Router();

orderRouter.get(
  "/my",
  requireAuth,
  validate(listMineOrdersQuerySchema, "query"),
  listMineOrdersController
);
orderRouter.get(
  "/my/:orderId",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  getMineOrderDetailController
);
orderRouter.post("/quote", requireAuth, validate(quoteSchema), quoteOrderController);
orderRouter.post(
  "/:orderId/confirm-accept",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  confirmAcceptController
);
orderRouter.post(
  "/:orderId/confirm-service",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  confirmServiceController
);
orderRouter.post(
  "/:orderId/confirm-complete",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  confirmOrderCompleteController
);
orderRouter.post(
  "/:orderId/cancel",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderBodySchema),
  cancelOrderController
);
orderRouter.post("/", requireAuth, validate(createOrderSchema), createOrderController);

export default orderRouter;
