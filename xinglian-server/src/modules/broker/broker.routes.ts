import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { orderIdParamSchema } from "../order/order.types";
import {
  getBrokerDashboardController,
  getBrokerOrderDetailController,
  listBrokerOrdersController,
  listMyMerchantsForBrokerController,
  listMyModelsForBrokerController
} from "./broker.controller";
import { brokerBoundListQuerySchema, brokerOrderListQuerySchema } from "./broker.types";

const brokerRouter = Router();

brokerRouter.get("/dashboard", requireAuth, getBrokerDashboardController);
brokerRouter.get(
  "/my-models",
  requireAuth,
  validate(brokerBoundListQuerySchema, "query"),
  listMyModelsForBrokerController
);
brokerRouter.get(
  "/my-merchants",
  requireAuth,
  validate(brokerBoundListQuerySchema, "query"),
  listMyMerchantsForBrokerController
);
brokerRouter.get(
  "/orders",
  requireAuth,
  validate(brokerOrderListQuerySchema, "query"),
  listBrokerOrdersController
);
brokerRouter.get(
  "/orders/:orderId",
  requireAuth,
  validate(orderIdParamSchema, "params"),
  getBrokerOrderDetailController
);

export default brokerRouter;
