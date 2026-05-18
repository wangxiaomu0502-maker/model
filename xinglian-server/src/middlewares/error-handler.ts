import { NextFunction, Request, Response } from "express";
import { ErrorCodes } from "../core/constants/error-codes";
import { AppError } from "../core/errors/app-error";
import { log } from "../core/logger";
import { RequestWithContext } from "./request-context";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    code: ErrorCodes.NOT_FOUND,
    message: "Route not found"
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code =
    err instanceof AppError ? err.code : ErrorCodes.INTERNAL_ERROR;
  const traceId = (req as RequestWithContext).traceId;

  log("error", err.message, {
    traceId,
    statusCode,
    code,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json({
    ok: false,
    message: statusCode === 500 ? "Internal server error" : err.message,
    code,
    traceId,
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
}
