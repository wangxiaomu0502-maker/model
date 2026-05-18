import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { buildWalletOverview } from "./wallet.service";

/** 钱包：模特(role=1)、经纪人(role=3)、代理人(role=4) */
export async function getWalletOverviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const role = Number(auth?.role);
    if (!userId) {
      return fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    }
    if (role !== 1 && role !== 3 && role !== 4) {
      throw new AppError("当前身份暂不提供钱包", 403, ErrorCodes.FORBIDDEN);
    }
    const q = req.query as { beforeId?: string; limit?: string };
    const rawBefore = q.beforeId != null && String(q.beforeId).trim() !== "" ? Number(q.beforeId) : NaN;
    const beforeId = Number.isFinite(rawBefore) ? rawBefore : null;
    const rawLimit = q.limit != null && String(q.limit).trim() !== "" ? Number(q.limit) : NaN;
    const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;

    const data = await buildWalletOverview(userId, role, { beforeId, limit });
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}
