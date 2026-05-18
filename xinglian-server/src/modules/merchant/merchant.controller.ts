import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { getMerchantBasicInfo, saveMerchantBasicInfo } from "./merchant.service";

function getUserId(req: Request): number | null {
  return (req as AuthenticatedRequest).auth?.userId ?? null;
}

export async function getMerchantMeController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const merchant = await getMerchantBasicInfo(userId);
    return success(res, { merchant });
  } catch (error) {
    return next(error);
  }
}

export async function saveMerchantBasicInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    const city = String((req.body as { city?: string }).city || "").trim();
    await saveMerchantBasicInfo(userId, city);
    return success(res);
  } catch (error) {
    return next(error);
  }
}

