import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export type RequestWithContext = Request & {
  traceId?: string;
};

export function requestContext(
  req: RequestWithContext,
  res: Response,
  next: NextFunction
): void {
  const incomingTraceId = req.header("x-trace-id");
  const traceId = incomingTraceId && incomingTraceId.trim()
    ? incomingTraceId
    : randomUUID();

  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);
  next();
}
