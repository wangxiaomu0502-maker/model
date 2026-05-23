import { Router } from "express";

import { optionalAuth, requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  getCategoryTreeController,
  getMerchantModelListController,
  getModelPublicDetailController,
  getMyCategoriesController,
  getModelDashboardStatsController,
  getModelMeController,
  getProfileAuditReadinessController,
  submitProfileAuditController,
  saveBasicInfoController,
  saveCardController,
  uploadModelCardImageController,
  uploadModelPortfolioImageController,
  uploadModelStylePositionImageController,
  saveCategoriesController,
  saveOrderSettingsController,
  savePortfolioController,
  savePricingController,
  saveScheduleController,
  saveStylePositionController
} from "./model.controller";
import { modelCardUploader } from "./model.card-upload.middleware";
import { modelPortfolioUploader } from "./model.portfolio-upload.middleware";
import {
  basicInfoSchema,
  cardSchema,
  categoriesSchema,
  modelDetailQuerySchema,
  orderSettingsSchema,
  portfolioSchema,
  pricingSchema,
  scheduleSchema,
  stylePositionSchema
} from "./model.types";

const modelRouter = Router();

modelRouter.get("/category-tree", requireAuth, getCategoryTreeController);
modelRouter.get("/dashboard-stats", requireAuth, getModelDashboardStatsController);
modelRouter.get("/list", optionalAuth, getMerchantModelListController);
modelRouter.get("/detail", optionalAuth, validate(modelDetailQuerySchema, "query"), getModelPublicDetailController);
modelRouter.get("/categories", requireAuth, getMyCategoriesController);
modelRouter.get("/me", requireAuth, getModelMeController);
modelRouter.get("/profile-audit-readiness", requireAuth, getProfileAuditReadinessController);
modelRouter.post("/profile-audit-submit", requireAuth, submitProfileAuditController);
modelRouter.put("/basic-info", requireAuth, validate(basicInfoSchema), saveBasicInfoController);
modelRouter.put("/categories", requireAuth, validate(categoriesSchema), saveCategoriesController);
modelRouter.put("/card", requireAuth, validate(cardSchema), saveCardController);
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

export default modelRouter;
