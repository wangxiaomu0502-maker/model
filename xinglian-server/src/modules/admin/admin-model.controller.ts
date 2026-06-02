import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";
import { resolveImageUploadMime } from "../../core/utils/resolve-upload-mime";
import { getCategoryTree } from "../model/model.service";

import type { AdminModelCreateBody, AdminModelUpdateBody } from "./admin-model.types";
import { uploadAdminAssetImageToCos, uploadAdminModelImageToCos } from "./admin-model-media.storage";
import { createModelForAdmin, updateModelForAdmin } from "./admin-model.service";

function requireAdmin(req: Request, res: Response): number | null {
  const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
  if (!adminAuth?.adminUserId) {
    fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    return null;
  }
  return adminAuth.adminUserId;
}

export async function adminGetModelCategoryTreeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const tree = await getCategoryTree();
    success(res, { tree });
  } catch (error) {
    next(error);
  }
}

export async function adminCreateModelController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const body = req.body as AdminModelCreateBody;
    const basicInfo = await createModelForAdmin(body);
    success(res, { basicInfo });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateModelController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as { userId: number };
    const body = req.body as AdminModelUpdateBody;
    const basicInfo = await updateModelForAdmin(userId, body);
    success(res, { basicInfo });
  } catch (error) {
    next(error);
  }
}

type ModelImageKind = "avatar" | "card" | "portfolio" | "style";

async function adminUploadModelImage(
  req: Request,
  res: Response,
  next: NextFunction,
  kind: ModelImageKind
): Promise<void> {
  try {
    const adminUserId = requireAdmin(req, res);
    if (adminUserId == null) return;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const mimetype = file ? resolveImageUploadMime(file) : null;
    if (!file || !mimetype) {
      throw new AppError("请上传 JPG、PNG 或 WEBP 图片", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const url = await uploadAdminModelImageToCos({
      adminUserId,
      kind,
      body: file.buffer,
      mimetype
    });
    success(res, { url });
  } catch (error) {
    next(error);
  }
}

export async function adminUploadModelAvatarController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return adminUploadModelImage(req, res, next, "avatar");
}

export async function adminUploadModelCardImageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return adminUploadModelImage(req, res, next, "card");
}

export async function adminUploadModelPortfolioImageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return adminUploadModelImage(req, res, next, "portfolio");
}

export async function adminUploadModelStyleImageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return adminUploadModelImage(req, res, next, "style");
}

export async function adminUploadAssetImageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUserId = requireAdmin(req, res);
    if (adminUserId == null) return;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const mimetype = file ? resolveImageUploadMime(file) : null;
    if (!file || !mimetype) {
      throw new AppError("请上传 JPG、PNG 或 WEBP 图片", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const url = await uploadAdminAssetImageToCos({
      adminUserId,
      body: file.buffer,
      mimetype
    });
    success(res, { url });
  } catch (error) {
    next(error);
  }
}
