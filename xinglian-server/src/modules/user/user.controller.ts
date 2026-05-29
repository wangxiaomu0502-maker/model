import { Request, Response, NextFunction } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import type { ContractKind } from "../admin/contract-templates.types";

import { resolveImageUploadMime } from "../../core/utils/resolve-upload-mime";
import type { UpdateNicknameBody } from "./user.nickname.types";
import type { CompleteModelRealnameBody } from "./user.realname.types";
import {
  completeModelRealnameForCurrentUser,
  getCurrentUserProfile,
  getMyContractForCurrentUser,
  signContractForCurrentUser,
  updateNicknameForCurrentUser
} from "./user.service";
import { updateUserAvatarUrl } from "./user.repository";
import { uploadAvatarToCos } from "./user.avatar.storage";
import { uploadBrokerLicenseToCos } from "./user.broker-license.storage";
import { uploadContractSignatureToCos } from "./user.contract-signature.storage";

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
    const mimetype = file ? resolveImageUploadMime(file) : null;
    if (!file || !mimetype) {
      throw new AppError(
        "头像格式不支持，请使用 JPG 或 PNG 图片",
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const avatarUrl = await uploadAvatarToCos({
      userId,
      body: file.buffer,
      mimetype
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

export async function uploadBrokerLicenseController(
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
    const mimetype = file ? resolveImageUploadMime(file) : null;
    if (!file || !mimetype) {
      throw new AppError(
        "经纪人证格式不支持，请使用 JPG 或 PNG 图片",
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const brokerLicenseUrl = await uploadBrokerLicenseToCos({
      userId,
      body: file.buffer,
      mimetype
    });
    return success(res, { brokerLicenseUrl });
  } catch (error) {
    return next(error);
  }
}

export async function updateNicknameController(
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
    const { nickname } = req.body as UpdateNicknameBody;
    const result = await updateNicknameForCurrentUser(userId, nickname);
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function completeModelRealnameController(
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
    const body = req.body as CompleteModelRealnameBody;
    const result = await completeModelRealnameForCurrentUser(userId, body);
    return success(res, result);
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

export async function getMyContractController(
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
    const data = await getMyContractForCurrentUser(userId, contractKind);
    return success(res, data);
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
