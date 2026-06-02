import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

import { ErrorCodes } from "../core/constants/error-codes";
import { fail } from "../core/http/response";

type ValidateTarget = "body" | "query" | "params";

export function validate(
  schema: ZodSchema,
  target: ValidateTarget = "body"
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      fail(req, res, 400, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "invalid request parameters",
        issues: result.error.issues
      });
      return;
    }

    if (target === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        configurable: true,
        enumerable: true,
        writable: true
      });
    } else if (target === "params") {
      // 不要整对象替换 req.params（Express 5 上可能破坏内部引用）；合并且统一为字符串，与路由层约定一致
      const parsed = result.data as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && value !== null) {
          (req.params as Record<string, string>)[key] = String(value);
        }
      }
    } else {
      req.body = result.data;
    }
    next();
  };
}
