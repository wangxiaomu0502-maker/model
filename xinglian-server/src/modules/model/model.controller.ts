import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import {
  getCategoryTree,
  getMerchantModelList,
  getModelPublicDetail,
  getMyCategories,
  getModelData,
  getProfileAuditReadiness,
  submitProfileAudit,
  saveBasicInfo,
  saveCard,
  saveCategories,
  saveOrderSettings,
  savePortfolio,
  savePricing,
  saveSchedule
} from "./model.service";
import { getModelDashboard } from "./model-dashboard.service";
import { uploadModelCardImageToCos, uploadModelPortfolioImageToCos } from "./model.card-upload.storage";

function getUserId(req: Request): number | null {
  return (req as AuthenticatedRequest).auth?.userId ?? null;
}

export async function getModelMeController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const data = await getModelData(userId);
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function getModelDashboardStatsController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    if (Number(auth.role) !== 1) {
      throw new AppError("仅模特可查看接单统计", 403, ErrorCodes.FORBIDDEN);
    }
    const data = await getModelDashboard(userId);
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function getProfileAuditReadinessController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const data = await getProfileAuditReadiness(userId);
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function submitProfileAuditController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    await submitProfileAudit(userId);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function saveBasicInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await saveBasicInfo(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function saveCategoriesController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await saveCategories(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function getCategoryTreeController(req: Request, res: Response, next: NextFunction) {
  try {
    const tree = await getCategoryTree();
    return success(res, { tree });
  } catch (error) {
    return next(error);
  }
}

export async function getMyCategoriesController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    const categories = await getMyCategories(userId);
    return success(res, categories as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function getMerchantModelListController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMerchantModelList();
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function getModelPublicDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const q = req.query as { userNo?: string; userId?: number };
    const viewerRole =
      authReq.auth?.role !== undefined && authReq.auth.role !== null ? Number(authReq.auth.role) : 0;
    const data = await getModelPublicDetail(q, { viewerRole });
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export async function saveCardController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await saveCard(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

const CARD_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const PORTFOLIO_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadModelPortfolioImageController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
    if (!file || !PORTFOLIO_IMAGE_MIME.has(file.mimetype)) {
      throw new AppError("invalid portfolio image", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const url = await uploadModelPortfolioImageToCos({
      userId,
      body: file.buffer,
      mimetype: file.mimetype
    });
    return success(res, { url });
  } catch (error) {
    return next(error);
  }
}

export async function uploadModelCardImageController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
    if (!file || !CARD_IMAGE_MIME.has(file.mimetype)) {
      throw new AppError("invalid model card image", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const url = await uploadModelCardImageToCos({
      userId,
      body: file.buffer,
      mimetype: file.mimetype
    });
    return success(res, { url });
  } catch (error) {
    return next(error);
  }
}

export async function savePortfolioController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await savePortfolio(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function savePricingController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await savePricing(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function saveScheduleController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await saveSchedule(userId, req.body as Record<string, unknown>);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

export async function saveOrderSettingsController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    await saveOrderSettings(userId, req.body as { settings: Record<string, unknown> });
    return success(res);
  } catch (error) {
    return next(error);
  }
}
