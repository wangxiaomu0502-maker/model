import { Request, Response } from "express";

import { RequestWithContext } from "../../middlewares/request-context";

export function success<T extends Record<string, unknown>>(
  res: Response,
  data?: T
): Response {
  res.type("application/json; charset=utf-8");
  return res.json({
    ok: true,
    ...(data ?? {})
  });
}

export function fail(
  req: Request,
  res: Response,
  status: number,
  payload: {
    code: string;
    message: string;
    issues?: unknown;
  }
): Response {
  const traceId = (req as RequestWithContext).traceId;
  res.type("application/json; charset=utf-8");
  return res.status(status).json({
    ok: false,
    code: payload.code,
    message: payload.message,
    traceId,
    ...(payload.issues ? { issues: payload.issues } : {})
  });
}
