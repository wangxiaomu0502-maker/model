import { Request, Response } from "express";

import { success } from "../../core/http/response";
import { getDbNow } from "./health.service";
import { HealthQueryDto } from "./health.types";

export function healthController(req: Request, res: Response): void {
  const query = req.query as HealthQueryDto;
  success(res, {
    service: "xinglian-server",
    timestamp: new Date().toISOString(),
    ...(query.verbose ? { env: process.env.NODE_ENV ?? "development" } : {})
  });
}

export async function healthDbController(
  _req: Request,
  res: Response
): Promise<void> {
  const rows = await getDbNow();
  success(res, {
    database: "mysql",
    result: rows
  });
}
