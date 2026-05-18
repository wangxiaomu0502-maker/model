import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
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
  saveCategoriesController,
  saveOrderSettingsController,
  savePortfolioController,
  savePricingController,
  saveScheduleController
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
  scheduleSchema
} from "./model.types";

const modelRouter = Router();

modelRouter.get("/category-tree", requireAuth, getCategoryTreeController);
modelRouter.get("/dashboard-stats", requireAuth, getModelDashboardStatsController);
modelRouter.get("/list", requireAuth, getMerchantModelListController);
modelRouter.get("/detail", requireAuth, validate(modelDetailQuerySchema, "query"), getModelPublicDetailController);
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
modelRouter.put("/pricing", requireAuth, validate(pricingSchema), savePricingController);
modelRouter.put("/schedule", requireAuth, validate(scheduleSchema), saveScheduleController);
modelRouter.put("/order-settings", requireAuth, validate(orderSettingsSchema), saveOrderSettingsController);

export default modelRouter;
