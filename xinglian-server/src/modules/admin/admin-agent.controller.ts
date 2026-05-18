import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import type { AdminAgentCreateBody, AdminAgentUpdateBody } from "./admin-agent.types";
import { AdminUserIdParam, AdminUserListQuery } from "./admin.types";
import { uploadAgentBusinessLicenseToCos } from "./admin-agent-license.storage";
import {
  createAgentForAdmin,
  deleteAgentForAdmin,
  getAgentDetailForAdmin,
  listAgentIncomeLedgerForAdmin,
  listAgentsForAdmin,
  listBoundModelsForAgentAdmin,
  updateAgentForAdminService
} from "./admin-agent.service";

function requireAdmin(req: Request, res: Response): number | null {
  const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
  if (!adminAuth?.adminUserId) {
    fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
    return null;
  }
  return adminAuth.adminUserId;
}

export async function adminListAgentsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listAgentsForAdmin(q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetAgentDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as AdminUserIdParam;
    const agent = await getAgentDetailForAdmin(userId);
    success(res, { agent });
  } catch (error) {
    next(error);
  }
}

export async function adminCreateAgentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const body = req.body as AdminAgentCreateBody;
    const agent = await createAgentForAdmin(body);
    success(res, { agent });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateAgentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminAgentUpdateBody;
    const agent = await updateAgentForAdminService(userId, body);
    success(res, { agent });
  } catch (error) {
    next(error);
  }
}

export async function adminUploadAgentLicenseController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUserId = requireAdmin(req, res);
    if (adminUserId == null) return;
    const file = req.file;
    if (!file?.buffer?.length) {
      fail(req, res, 400, { code: ErrorCodes.VALIDATION_ERROR, message: "请上传营业执照文件" });
      return;
    }
    const url = await uploadAgentBusinessLicenseToCos({
      adminUserId,
      body: file.buffer,
      mimetype: file.mimetype || "image/jpeg"
    });
    success(res, { url });
  } catch (error) {
    next(error);
  }
}

export async function adminListAgentBoundModelsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as AdminUserIdParam;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listBoundModelsForAgentAdmin(userId, q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminListAgentIncomeLedgerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as AdminUserIdParam;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listAgentIncomeLedgerForAdmin(userId, q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteAgentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (requireAdmin(req, res) == null) return;
    const { userId } = req.params as unknown as AdminUserIdParam;
    const unbind =
      req.query.unbindModels === "1" ||
      req.query.unbindModels === "true" ||
      (req.body as { unbindModels?: boolean })?.unbindModels === true;
    await deleteAgentForAdmin(userId, { unbindModels: unbind });
    success(res, { ok: true });
  } catch (error) {
    next(error);
  }
}
