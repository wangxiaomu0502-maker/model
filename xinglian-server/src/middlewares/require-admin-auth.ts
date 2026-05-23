import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { ErrorCodes } from "../core/constants/error-codes";
import { fail } from "../core/http/response";

export type AdminBackofficeRole = "admin" | "cs";

export type AdminJwtPayload = {
  scope?: string;
  adminUserId?: number;
  role?: AdminBackofficeRole;
};

export type AdminAuthenticatedRequest = import("express").Request & {
  adminAuth?: {
    adminUserId: number;
    role: AdminBackofficeRole;
  };
};

function verifyBackofficeToken(token: string): AdminJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.secret) as AdminJwtPayload;
    if (decoded.scope !== "admin" || typeof decoded.adminUserId !== "number") {
      return null;
    }
    const role = decoded.role === "cs" ? "cs" : "admin";
    return { ...decoded, role };
  } catch {
    return null;
  }
}

function extractToken(req: import("express").Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

function attachAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction,
  allowedRoles: AdminBackofficeRole[]
): void {
  const token = extractToken(req);
  if (!token) {
    fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    return;
  }

  const decoded = verifyBackofficeToken(token);
  if (!decoded?.adminUserId || !decoded.role) {
    fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "invalid token" });
    return;
  }

  if (!allowedRoles.includes(decoded.role)) {
    fail(req, res, 403, { code: ErrorCodes.FORBIDDEN, message: "forbidden" });
    return;
  }

  req.adminAuth = { adminUserId: decoded.adminUserId, role: decoded.role };
  next();
}

/** 仅管理员可访问 */
export function requireAdminAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  attachAuth(req, res, next, ["admin"]);
}

/** 仅客服可访问 */
export function requireCsAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  attachAuth(req, res, next, ["cs"]);
}

/** 管理员或客服均可访问 */
export function requireBackofficeAuth(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  attachAuth(req, res, next, ["admin", "cs"]);
}
