import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import type { CreateEidTokenBody, VerifyEidResultBody } from "./eid.dto";
import { createEidToken, verifyEidResult } from "./eid.service";

export async function createEidTokenController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const { realName, idCardNo } = req.body as CreateEidTokenBody;
    const result = await createEidToken({ userId, realName, idCardNo });
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function verifyEidResultController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const { eidToken, realName, idCardNo } = req.body as VerifyEidResultBody;
    const result = await verifyEidResult({ userId, eidToken, realName, idCardNo });
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}
