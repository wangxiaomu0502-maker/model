import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AppError } from "../../core/errors/app-error";

import { loginAdmin } from "./admin-auth.service";
import { AdminLoginDto } from "./admin-auth.types";

export async function adminLoginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as AdminLoginDto;
    const result = await loginAdmin(body.username, body.password);
    success(res, {
      token: result.token,
      admin: result.admin
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      fail(req, res, 401, {
        code: error.code,
        message: error.message
      });
      return;
    }
    next(error);
  }
}
