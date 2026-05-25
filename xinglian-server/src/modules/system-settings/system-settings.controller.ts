import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import { getSystemSettings, updateSystemSettings } from "./system-settings.service";
import type { SystemSettingsUpdateDto } from "./system-settings.types";

export async function adminGetSystemSettingsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const data = await getSystemSettings();
    success(res, data);
  } catch (e) {
    next(e);
  }
}

export async function adminPutSystemSettingsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const data = await updateSystemSettings(req.body as SystemSettingsUpdateDto);
    success(res, data);
  } catch (e) {
    next(e);
  }
}

export async function getMerchantOrderSettingController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getSystemSettings();
    success(res, {
      merchantOrderEnabled: data.merchantOrderEnabled
    });
  } catch (e) {
    next(e);
  }
}
