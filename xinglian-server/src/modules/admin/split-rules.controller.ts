import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import { getSplitRulesForAdmin, updateSplitRulesForAdmin } from "./split-rules.service";
import type { SplitRulesUpdateDto } from "./split-rules.types";

export async function adminGetSplitRulesController(
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
    const data = await getSplitRulesForAdmin();
    success(res, data as Record<string, unknown>);
  } catch (e) {
    next(e);
  }
}

export async function adminPutSplitRulesController(
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
    const body = req.body as SplitRulesUpdateDto;
    const data = await updateSplitRulesForAdmin(body);
    success(res, data as Record<string, unknown>);
  } catch (e) {
    next(e);
  }
}
