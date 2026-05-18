import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { fail, success } from "../../core/http/response";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { detectIdCardBySide } from "./ocr.service";

const OCR_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function idCardOcrController(
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
    if (!file || !OCR_IMAGE_MIME.has(file.mimetype)) {
      throw new AppError("invalid ocr image", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const side = (req.body as { side?: string })?.side;
    const result = await detectIdCardBySide({
      userId,
      side,
      fileBuffer: file.buffer,
      mimetype: file.mimetype
    });
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}
