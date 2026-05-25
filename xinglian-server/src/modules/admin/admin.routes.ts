import { Router } from "express";

import {
  requireAdminAuth,
  requireBackofficeAuth,
  requireCsAuth
} from "../../middlewares/require-admin-auth";
import { validate } from "../../middlewares/validate";

import { adminLoginController } from "../admin-auth/admin-auth.controller";
import { adminLoginSchema } from "../admin-auth/admin-auth.types";
import {
  adminHealthController,
  adminGetOrderDetailController,
  adminGetModelDetailController,
  adminListModelOrdersController,
  adminGetMerchantDetailController,
  adminGetMerchantExpenseStatsController,
  adminGetModelIncomeStatsController,
  adminListMerchantOrdersController,
  adminGetBrokerDetailController,
  adminGetBrokerIncomeStatsController,
  adminListBrokerBoundMerchantsController,
  adminListBrokerBoundModelsController,
  adminReviewModelProfileAuditController,
  adminSetModelAgentController,
  adminSetMerchantBrokerController,
  adminListOrdersController,
  adminListUsersWithRoleQueryController,
  adminPostOrderSplitController,
  adminGetOrderSplitPreviewController,
  adminDashboardStatsController,
  adminPlatformBillingController,
  adminPlatformLedgerController,
  createAdminListUsersByRoleController
} from "./admin.controller";
import {
  adminModelAgentBodySchema,
  adminMerchantBrokerBodySchema,
  adminModelProfileAuditBodySchema,
  adminOrderIdParamSchema,
  adminPlatformLedgerQuerySchema,
  adminUserIdParamSchema,
  adminUserListQuerySchema,
  adminUsersByRoleQuerySchema
} from "./admin.types";
import {
  adminListContractTemplatesController,
  adminPutContractTemplateController
} from "./contract-templates.controller";
import { contractKindParamSchema, contractTemplateUpdateBodySchema } from "./contract-templates.types";
import { adminGetSplitRulesController, adminPutSplitRulesController } from "./split-rules.controller";
import { splitRulesUpdateSchema } from "./split-rules.types";
import {
  adminGetSystemSettingsController,
  adminPutSystemSettingsController
} from "../system-settings/system-settings.controller";
import { systemSettingsUpdateSchema } from "../system-settings/system-settings.types";
import {
  adminCreateAgentController,
  adminDeleteAgentController,
  adminGetAgentDetailController,
  adminListAgentBoundModelsController,
  adminListAgentIncomeLedgerController,
  adminListAgentsController,
  adminUpdateAgentController,
  adminUploadAgentLicenseController
} from "./admin-agent.controller";
import { agentLicenseUploader } from "./admin-agent-license.middleware";
import {
  adminAgentCreateBodySchema,
  adminAgentUpdateBodySchema
} from "./admin-agent.types";
import {
  adminCreateModelController,
  adminGetModelCategoryTreeController,
  adminUploadModelAvatarController,
  adminUploadModelCardImageController,
  adminUploadModelPortfolioImageController,
  adminUploadModelStyleImageController
} from "./admin-model.controller";
import { adminModelImageUploader } from "./admin-model-media.middleware";
import { adminModelCreateBodySchema } from "./admin-model.types";
import {
  addPendingOrderNoteHandler,
  completePendingOrderHandler,
  getPendingOrderDetailHandler,
  listPendingOrdersHandler,
  startPendingOrderHandler
} from "../admin-cs-order/admin-cs-order.controller";
import {
  csOrderIdParamSchema,
  csOrderNoteBodySchema,
  csPendingOrderListQuerySchema
} from "../admin-cs-order/admin-cs-order.types";
import {
  createCsUserHandler,
  deleteCsUserHandler,
  listCsUsersHandler,
  updateCsUserHandler
} from "../admin-cs-user/admin-cs-user.controller";
import {
  createCsUserSchema,
  csUserIdParamSchema,
  csUserListQuerySchema,
  updateCsUserSchema
} from "../admin-cs-user/admin-cs-user.types";

const adminRouter = Router();

adminRouter.get("/health", adminHealthController);
adminRouter.get("/stats/dashboard", requireAdminAuth, adminDashboardStatsController);
adminRouter.get(
  "/platform-billing",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  adminPlatformBillingController
);
adminRouter.get(
  "/platform-ledger",
  requireAdminAuth,
  validate(adminPlatformLedgerQuerySchema, "query"),
  adminPlatformLedgerController
);
/** 兼容旧路径，返回字段含 dashboard 全量 */
adminRouter.get("/stats/users", requireAdminAuth, adminDashboardStatsController);
adminRouter.post("/login", validate(adminLoginSchema), adminLoginController);

adminRouter.get(
  "/cs-users",
  requireAdminAuth,
  validate(csUserListQuerySchema, "query"),
  listCsUsersHandler
);
adminRouter.post(
  "/cs-users",
  requireAdminAuth,
  validate(createCsUserSchema),
  createCsUserHandler
);
adminRouter.patch(
  "/cs-users/:id",
  requireAdminAuth,
  validate(csUserIdParamSchema, "params"),
  validate(updateCsUserSchema),
  updateCsUserHandler
);
adminRouter.delete(
  "/cs-users/:id",
  requireAdminAuth,
  validate(csUserIdParamSchema, "params"),
  deleteCsUserHandler
);
adminRouter.get(
  "/pending-orders",
  requireBackofficeAuth,
  validate(csPendingOrderListQuerySchema, "query"),
  listPendingOrdersHandler
);
adminRouter.get(
  "/pending-orders/:orderId",
  requireBackofficeAuth,
  validate(csOrderIdParamSchema, "params"),
  getPendingOrderDetailHandler
);
adminRouter.post(
  "/pending-orders/:orderId/start",
  requireCsAuth,
  validate(csOrderIdParamSchema, "params"),
  startPendingOrderHandler
);
adminRouter.post(
  "/pending-orders/:orderId/complete",
  requireCsAuth,
  validate(csOrderIdParamSchema, "params"),
  completePendingOrderHandler
);
adminRouter.post(
  "/pending-orders/:orderId/notes",
  requireCsAuth,
  validate(csOrderIdParamSchema, "params"),
  validate(csOrderNoteBodySchema),
  addPendingOrderNoteHandler
);
adminRouter.get(
  "/users",
  requireAdminAuth,
  validate(adminUsersByRoleQuerySchema, "query"),
  adminListUsersWithRoleQueryController
);
adminRouter.get(
  "/models",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  createAdminListUsersByRoleController(1)
);
adminRouter.get(
  "/models/category-tree",
  requireAdminAuth,
  adminGetModelCategoryTreeController
);
adminRouter.post(
  "/models/avatar/upload",
  requireAdminAuth,
  adminModelImageUploader.single("file"),
  adminUploadModelAvatarController
);
adminRouter.post(
  "/models/card/upload",
  requireAdminAuth,
  adminModelImageUploader.single("file"),
  adminUploadModelCardImageController
);
adminRouter.post(
  "/models/portfolio/upload",
  requireAdminAuth,
  adminModelImageUploader.single("file"),
  adminUploadModelPortfolioImageController
);
adminRouter.post(
  "/models/style/upload",
  requireAdminAuth,
  adminModelImageUploader.single("file"),
  adminUploadModelStyleImageController
);
adminRouter.post(
  "/models",
  requireAdminAuth,
  validate(adminModelCreateBodySchema),
  adminCreateModelController
);
adminRouter.get(
  "/models/:userId/detail",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetModelDetailController
);
adminRouter.get(
  "/models/:userId/orders",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListModelOrdersController
);
adminRouter.post(
  "/models/:userId/profile-audit",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminModelProfileAuditBodySchema),
  adminReviewModelProfileAuditController
);
adminRouter.patch(
  "/models/:userId/agent",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminModelAgentBodySchema),
  adminSetModelAgentController
);
adminRouter.get(
  "/agent-users",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  adminListAgentsController
);
adminRouter.get(
  "/agents",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  adminListAgentsController
);
adminRouter.post(
  "/agents/license/upload",
  requireAdminAuth,
  agentLicenseUploader.single("file"),
  adminUploadAgentLicenseController
);
adminRouter.post(
  "/agents",
  requireAdminAuth,
  validate(adminAgentCreateBodySchema),
  adminCreateAgentController
);
adminRouter.get(
  "/agents/:userId/bound-models",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListAgentBoundModelsController
);
adminRouter.get(
  "/agents/:userId/income-ledger",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListAgentIncomeLedgerController
);
adminRouter.get(
  "/agents/:userId",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetAgentDetailController
);
adminRouter.patch(
  "/agents/:userId",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminAgentUpdateBodySchema),
  adminUpdateAgentController
);
adminRouter.delete(
  "/agents/:userId",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminDeleteAgentController
);
adminRouter.get(
  "/merchants/:userId/detail",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetMerchantDetailController
);
adminRouter.patch(
  "/merchants/:userId/broker",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminMerchantBrokerBodySchema),
  adminSetMerchantBrokerController
);
adminRouter.get(
  "/merchants/:userId/expense-stats",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetMerchantExpenseStatsController
);
adminRouter.get(
  "/merchants/:userId/orders",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListMerchantOrdersController
);
adminRouter.get(
  "/merchants",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  createAdminListUsersByRoleController(2)
);
adminRouter.get(
  "/brokers/:userId/detail",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetBrokerDetailController
);
adminRouter.get(
  "/brokers/:userId/income-stats",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  adminGetBrokerIncomeStatsController
);
adminRouter.get(
  "/brokers/:userId/bound-merchants",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListBrokerBoundMerchantsController
);
adminRouter.get(
  "/brokers/:userId/bound-models",
  requireAdminAuth,
  validate(adminUserIdParamSchema, "params"),
  validate(adminUserListQuerySchema, "query"),
  adminListBrokerBoundModelsController
);
adminRouter.get(
  "/brokers",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  createAdminListUsersByRoleController(3)
);
/** 订单详情：路径形态与「模特详情」`/models/:userId/detail` 一致（中间字面量段），与其它后台接口同属 admin 子路由 */
adminRouter.get(
  "/orders/item/:orderId/split-preview",
  requireAdminAuth,
  validate(adminOrderIdParamSchema, "params"),
  adminGetOrderSplitPreviewController
);
adminRouter.get(
  "/orders/item/:orderId",
  requireAdminAuth,
  validate(adminOrderIdParamSchema, "params"),
  adminGetOrderDetailController
);
adminRouter.post(
  "/orders/item/:orderId/split",
  requireAdminAuth,
  validate(adminOrderIdParamSchema, "params"),
  adminPostOrderSplitController
);
adminRouter.get(
  "/orders",
  requireAdminAuth,
  validate(adminUserListQuerySchema, "query"),
  adminListOrdersController
);
adminRouter.get("/split-rules", requireAdminAuth, adminGetSplitRulesController);
adminRouter.put(
  "/split-rules",
  requireAdminAuth,
  validate(splitRulesUpdateSchema),
  adminPutSplitRulesController
);
adminRouter.get("/system-settings", requireAdminAuth, adminGetSystemSettingsController);
adminRouter.put(
  "/system-settings",
  requireAdminAuth,
  validate(systemSettingsUpdateSchema),
  adminPutSystemSettingsController
);
adminRouter.get("/contract-templates", requireAdminAuth, adminListContractTemplatesController);
adminRouter.put(
  "/contract-templates/:contractKind",
  requireAdminAuth,
  validate(contractKindParamSchema, "params"),
  validate(contractTemplateUpdateBodySchema),
  adminPutContractTemplateController
);

export default adminRouter;
