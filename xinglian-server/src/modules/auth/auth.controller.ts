import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { success, fail } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import {
  bindPhone,
  completeRegistration,
  deleteAccount,
  issueUserAccessToken,
  loginByWechatCode
} from "./auth.service";

export async function wechatLoginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { code } = req.body as { code: string };

    const result = await loginByWechatCode(code);
    return success(res, {
      user: result.user,
      token: result.token
    });
  } catch (error) {
    return next(error);
  }
}

export async function bindPhoneController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { userId } = (req as AuthenticatedRequest).auth ?? {};
    const { code } = req.body as { code: string };

    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const result = await bindPhone(userId, code);
    return success(res, {
      phone: result.phone
    });
  } catch (error) {
    return next(error);
  }
}

export async function completeRegistrationController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const userId = auth?.userId;
    const openid = auth?.openid;
    const {
      role,
      identity,
      phone,
      faceVerified,
      nickname,
      avatarUrl,
      realName,
      idCardNo,
      idCardFrontUrl,
      idCardBackUrl,
      idCardIssueAuthority,
      idCardValidDate
    } = req.body as {
      role?: number;
      identity?: string;
      phone: string;
      faceVerified?: boolean;
      nickname: string;
      avatarUrl: string;
      realName: string;
      idCardNo: string;
      idCardFrontUrl: string;
      idCardBackUrl: string;
      idCardIssueAuthority: string;
      idCardValidDate: string;
    };

    if (!userId || !openid) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const result = await completeRegistration({
      userId,
      role,
      identity,
      phone,
      faceVerified,
      nickname,
      avatarUrl,
      realName,
      idCardNo,
      idCardFrontUrl,
      idCardBackUrl,
      idCardIssueAuthority,
      idCardValidDate
    });

    const token = issueUserAccessToken(userId, openid, result.role);

    return success(res, {
      role: result.role,
      verifiedStatus: result.verifiedStatus,
      profileAuditStatus: result.profileAuditStatus,
      token
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { userId, openid } = (req as AuthenticatedRequest).auth ?? {};
    if (!userId || !openid) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const result = await deleteAccount(userId, openid);
    if (!result.reverted) {
      return fail(req, res, 404, {
        code: ErrorCodes.NOT_FOUND,
        message: "user not found"
      });
    }

    return success(res, {
      reverted: result.reverted
    });
  } catch (error) {
    return next(error);
  }
}
