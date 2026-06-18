import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ErrorCodes } from "../core/constants/error-codes";
import { AppError } from "../core/errors/app-error";
import { log } from "../core/logger";
import { IMAGE_UPLOAD_MAX_LABEL } from "../core/utils/image-upload-limits";
import { RequestWithContext } from "./request-context";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    code: ErrorCodes.NOT_FOUND,
    message: "Route not found"
  });
}

function isRetriableNetworkError(err: Error): boolean {
  const errno = (err as NodeJS.ErrnoException).code;
  return errno === "ETIMEDOUT" || errno === "ECONNRESET" || errno === "EPIPE" || errno === "PROTOCOL_CONNECTION_LOST";
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const uploadSizeExceeded = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
  const networkError = !(err instanceof AppError) && isRetriableNetworkError(err);
  const statusCode = uploadSizeExceeded
    ? 400
    : err instanceof AppError
      ? err.statusCode
      : networkError
        ? 502
        : 500;
  const code = uploadSizeExceeded
    ? ErrorCodes.VALIDATION_ERROR
    : err instanceof AppError
      ? err.code
      : networkError
        ? ErrorCodes.UPSTREAM_ERROR
        : ErrorCodes.INTERNAL_ERROR;
  const message = uploadSizeExceeded
    ? `图片大小不能超过 ${IMAGE_UPLOAD_MAX_LABEL}`
    : networkError
      ? "网络连接超时，请稍后重试"
      : err.message;
  const traceId = (req as RequestWithContext).traceId;

  log("error", message, {
    traceId,
    statusCode,
    code,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json({
    ok: false,
    message: statusCode === 500 ? "Internal server error" : message,
    code,
    traceId,
    error: process.env.NODE_ENV === "development" ? (networkError ? err.message : message) : undefined
  });
}
