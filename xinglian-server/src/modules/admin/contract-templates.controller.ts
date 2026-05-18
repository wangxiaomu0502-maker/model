import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import {
  getContractTemplatePublic,
  listContractTemplatesForAdmin,
  updateContractTemplateForAdmin
} from "./contract-templates.service";
import type { ContractKind } from "./contract-templates.types";
import type { ContractTemplateUpdateBody } from "./contract-templates.types";

export async function adminListContractTemplatesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const data = await listContractTemplatesForAdmin();
    success(res, data as Record<string, unknown>);
  } catch (e) {
    next(e);
  }
}

export async function adminPutContractTemplateController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { contractKind } = req.params as { contractKind: ContractKind };
    const body = req.body as ContractTemplateUpdateBody;
    const data = await updateContractTemplateForAdmin(contractKind, body);
    success(res, data as Record<string, unknown>);
  } catch (e) {
    next(e);
  }
}

/** 用户端 / 小程序：按类型获取合同正文 HTML（无需登录） */
export async function publicGetContractTemplateController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { contractKind } = req.params as { contractKind: ContractKind };
    const data = await getContractTemplatePublic(contractKind);
    success(res, data as Record<string, unknown>);
  } catch (e) {
    next(e);
  }
}
