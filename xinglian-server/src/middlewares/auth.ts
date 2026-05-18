import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { ErrorCodes } from "../core/constants/error-codes";
import { fail } from "../core/http/response";

type AuthTokenPayload = {
  userId: number;
  openid: string;
  role: number;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

export function requireAuth(
  req: AuthenticatedRequest,
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
    const decoded = jwt.verify(token, env.jwt.secret) as AuthTokenPayload;
    req.auth = decoded;
    next();
  } catch {
    fail(req, res, 401, {
      code: ErrorCodes.UNAUTHORIZED,
      message: "invalid token"
    });
  }
}
