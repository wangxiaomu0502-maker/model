import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import { uploadAdminHomeBannerVideoToCos } from "./home-banner-media.storage";
import {
  createHomeBanner,
  getPublishedHomeBannerById,
  listHomeBannersForAdmin,
  listPublishedHomeBanners,
  removeHomeBanner,
  updateHomeBannerById
} from "./home-banner.service";
import {
  createHomeBannerSchema,
  homeBannerIdParamSchema,
  homeBannerListQuerySchema,
  updateHomeBannerSchema
} from "./home-banner.types";

function requireAdmin(req: Request, res: Response): number | null {
  const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
  if (!adminAuth?.adminUserId) {
    fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    return null;
  }
  return adminAuth.adminUserId;
}

function resolveVideoUploadMime(file: Express.Multer.File): string | null {
  const mimetype = String(file.mimetype || "").toLowerCase();
  if (mimetype === "video/mp4" || mimetype === "video/quicktime") {
    return mimetype;
  }
  return null;
}

export async function adminListHomeBannersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = homeBannerListQuerySchema.parse(req.query);
    const data = await listHomeBannersForAdmin(query.page, query.pageSize);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminCreateHomeBannerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createHomeBannerSchema.parse(req.body);
    const data = await createHomeBanner(body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateHomeBannerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = homeBannerIdParamSchema.parse(req.params);
    const body = updateHomeBannerSchema.parse(req.body);
    const data = await updateHomeBannerById(id, body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteHomeBannerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = homeBannerIdParamSchema.parse(req.params);
    await removeHomeBanner(id);
    success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function adminUploadHomeBannerVideoController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUserId = requireAdmin(req, res);
    if (adminUserId == null) return;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const mimetype = file ? resolveVideoUploadMime(file) : null;
    if (!file || !mimetype) {
      throw new AppError("请上传 MP4 或 MOV 视频", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const url = await uploadAdminHomeBannerVideoToCos({
      adminUserId,
      body: file.buffer,
      mimetype
    });
    success(res, { url });
  } catch (error) {
    next(error);
  }
}

export async function listPublishedHomeBannersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await listPublishedHomeBanners();
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getPublishedHomeBannerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = homeBannerIdParamSchema.parse(req.params);
    const data = await getPublishedHomeBannerById(id);
    success(res, data);
  } catch (error) {
    next(error);
  }
}
