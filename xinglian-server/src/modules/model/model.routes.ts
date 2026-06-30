import { Router } from "express";

import { optionalAuth, requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  getCategoryTreeController,
  getHomeSummaryController,
  getMerchantModelListController,
  getModelPromoQrcodeController,
  getModelPublicDetailController,
  getMyCategoriesController,
  getModelDashboardStatsController,
  getModelMeController,
  activateModelWithCodeController,
  getProfileAuditReadinessController,
  submitProfileAuditController,
  saveBasicInfoController,
  saveCardController,
  uploadModelCardImageController,
  uploadModelPortfolioImageController,
  uploadModelStylePositionImageController,
  uploadModelHonorImageController,
  saveCategoriesController,
  saveOrderSettingsController,
  savePortfolioController,
  savePricingController,
  saveScheduleController,
  saveStylePositionController,
  listModelHonorsController,
  createModelHonorController,
  updateModelHonorController,
  deleteModelHonorController
} from "./model.controller";
import { modelCardUploader } from "./model.card-upload.middleware";
import { modelPortfolioUploader } from "./model.portfolio-upload.middleware";
import {
  basicInfoSchema,
  categoriesSchema,
  modelCardSaveSchema,
  modelDetailQuerySchema,
  orderSettingsSchema,
  portfolioSchema,
  pricingSchema,
  scheduleSchema,
  stylePositionSchema
} from "./model.types";
import {
  modelHonorCreateBodySchema,
  modelHonorIdParamSchema,
  modelHonorUpdateBodySchema
} from "./model-honor.types";
import { verifyModelRegistrationCodeSchema } from "../model-registration-code/model-registration-code.types";

const modelRouter = Router();

modelRouter.get("/category-tree", optionalAuth, getCategoryTreeController);
modelRouter.get("/home-summary", optionalAuth, getHomeSummaryController);
modelRouter.get("/dashboard-stats", requireAuth, getModelDashboardStatsController);
modelRouter.get("/list", optionalAuth, getMerchantModelListController);
modelRouter.get("/promo-qrcode", requireAuth, getModelPromoQrcodeController);
modelRouter.get("/detail", optionalAuth, validate(modelDetailQuerySchema, "query"), getModelPublicDetailController);
modelRouter.get("/categories", requireAuth, getMyCategoriesController);
modelRouter.get("/me", requireAuth, getModelMeController);
modelRouter.post(
  "/activate-with-code",
  requireAuth,
  validate(verifyModelRegistrationCodeSchema),
  activateModelWithCodeController
);
modelRouter.get("/profile-audit-readiness", requireAuth, getProfileAuditReadinessController);
modelRouter.post("/profile-audit-submit", requireAuth, submitProfileAuditController);
modelRouter.put("/basic-info", requireAuth, validate(basicInfoSchema), saveBasicInfoController);
modelRouter.put("/categories", requireAuth, validate(categoriesSchema), saveCategoriesController);
modelRouter.put("/card", requireAuth, validate(modelCardSaveSchema), saveCardController);
modelRouter.post("/card/upload", requireAuth, modelCardUploader.single("file"), uploadModelCardImageController);
modelRouter.post(
  "/portfolio/upload",
  requireAuth,
  modelPortfolioUploader.single("file"),
  uploadModelPortfolioImageController
);
modelRouter.put("/portfolio", requireAuth, validate(portfolioSchema), savePortfolioController);
modelRouter.post(
  "/style-position/upload",
  requireAuth,
  modelPortfolioUploader.single("file"),
  uploadModelStylePositionImageController
);
modelRouter.put("/style-position", requireAuth, validate(stylePositionSchema), saveStylePositionController);
modelRouter.put("/pricing", requireAuth, validate(pricingSchema), savePricingController);
modelRouter.put("/schedule", requireAuth, validate(scheduleSchema), saveScheduleController);
modelRouter.put("/order-settings", requireAuth, validate(orderSettingsSchema), saveOrderSettingsController);

modelRouter.get("/honors", requireAuth, listModelHonorsController);
modelRouter.post("/honors", requireAuth, validate(modelHonorCreateBodySchema), createModelHonorController);
modelRouter.patch(
  "/honors/:honorId",
  requireAuth,
  validate(modelHonorIdParamSchema, "params"),
  validate(modelHonorUpdateBodySchema),
  updateModelHonorController
);
modelRouter.delete(
  "/honors/:honorId",
  requireAuth,
  validate(modelHonorIdParamSchema, "params"),
  deleteModelHonorController
);
modelRouter.post(
  "/honors/upload",
  requireAuth,
  modelPortfolioUploader.single("file"),
  uploadModelHonorImageController
);

export default modelRouter;
