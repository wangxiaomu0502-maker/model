import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { ErrorCodes } from "../core/constants/error-codes";
import { fail } from "../core/http/response";

export type AdminJwtPayload = {
  scope?: string;
  adminUserId?: number;
};

export type AdminAuthenticatedRequest = import("express").Request & {
  adminAuth?: {
    adminUserId: number;
  };
};

export function requireAdminAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    fail(req, res, 401, {
      code: ErrorCodes.UNAUTHORIZED,
      message: "unauthorized"
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    fail(req, res, 401, {
      code: ErrorCodes.UNAUTHORIZED,
      message: "unauthorized"
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as AdminJwtPayload;
    if (decoded.scope !== "admin" || typeof decoded.adminUserId !== "number") {
      fail(req, res, 401, {
        code: ErrorCodes.UNAUTHORIZED,
        message: "invalid admin token"
      });
      return;
    }
    req.adminAuth = { adminUserId: decoded.adminUserId };
    next();
  } catch {
    fail(req, res, 401, {
      code: ErrorCodes.UNAUTHORIZED,
      message: "invalid token"
    });
  }
}
