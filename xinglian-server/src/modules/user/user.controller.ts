import { Request, Response, NextFunction } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import type { ContractKind } from "../admin/contract-templates.types";

import type { PutMyReferrerBody } from "./user.referrer.types";
import { getCurrentUserProfile, setMyReferrerBrokerByUserNo, signContractForCurrentUser } from "./user.service";
import { updateUserAvatarUrl } from "./user.repository";
import { uploadAvatarToCos } from "./user.avatar.storage";
import { uploadContractSignatureToCos } from "./user.contract-signature.storage";

const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONTRACT_SIGNATURE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadAvatarController(
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

    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File })
      .file;
    if (!file || !AVATAR_MIME.has(file.mimetype)) {
      throw new AppError(
        "invalid avatar file",
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const avatarUrl = await uploadAvatarToCos({
      userId,
      body: file.buffer,
      mimetype: file.mimetype
    });
    const updated = await updateUserAvatarUrl(userId, avatarUrl);
    if (!updated) {
      throw new AppError(
        "failed to update avatar",
        500,
        ErrorCodes.INTERNAL_ERROR
      );
    }
    return success(res, { avatarUrl });
  } catch (error) {
    return next(error);
  }
}

export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { userId } = (req as AuthenticatedRequest).auth ?? {};
    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const profile = await getCurrentUserProfile(userId);
    return success(res, {
      user: profile
    });
  } catch (error) {
    return next(error);
  }
}

export async function putMyReferrerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { userId } = (req as AuthenticatedRequest).auth ?? {};
    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const { brokerUserNo } = req.body as PutMyReferrerBody;
    const profile = await setMyReferrerBrokerByUserNo(userId, brokerUserNo);
    return success(res, { user: profile });
  } catch (error) {
    return next(error);
  }
}

export async function signMyContractController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { userId } = (req as AuthenticatedRequest).auth ?? {};
    if (!userId) {
      return fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "unauthorized"
      });
    }

    const { contractKind } = req.params as { contractKind: ContractKind };
    const body = req.body as { signatureUrl?: string };
    const signedAt = await signContractForCurrentUser(userId, contractKind, String(body.signatureUrl || ""));
    return success(res, { contractKind, signedAt });
  } catch (error) {
    return next(error);
  }
}

export async function uploadContractSignatureController(
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

    const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
    if (!file || !CONTRACT_SIGNATURE_MIME.has(file.mimetype)) {
      throw new AppError("invalid signature image", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const signatureUrl = await uploadContractSignatureToCos({
      userId,
      body: file.buffer,
      mimetype: file.mimetype
    });
    return success(res, { signatureUrl });
  } catch (error) {
    return next(error);
  }
}
