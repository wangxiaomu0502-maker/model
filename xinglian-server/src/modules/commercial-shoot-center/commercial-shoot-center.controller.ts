import { NextFunction, Request, Response } from "express";

import { success } from "../../core/http/response";

import {
  createCommercialShoot,
  createCommercialShootPackage,
  listCommercialShootsForAdmin,
  listCommercialShootPackagesForAdmin,
  listPublishedCommercialShoots,
  removeCommercialShoot,
  removeCommercialShootPackage,
  updateCommercialShootById,
  updateCommercialShootPackageById
} from "./commercial-shoot-center.service";
import {
  commercialShootIdParamSchema,
  commercialShootListQuerySchema,
  commercialShootPackageIdParamSchema,
  commercialShootPackageListQuerySchema,
  createCommercialShootSchema,
  createCommercialShootPackageSchema,
  publicCommercialShootListQuerySchema,
  updateCommercialShootSchema,
  updateCommercialShootPackageSchema
} from "./commercial-shoot-center.types";

export async function adminListCommercialShootsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = commercialShootListQuerySchema.parse(req.query);
    const data = await listCommercialShootsForAdmin(query.page, query.pageSize);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminCreateCommercialShootController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createCommercialShootSchema.parse(req.body);
    const data = await createCommercialShoot(body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateCommercialShootController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = commercialShootIdParamSchema.parse(req.params);
    const body = updateCommercialShootSchema.parse(req.body);
    const data = await updateCommercialShootById(id, body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteCommercialShootController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = commercialShootIdParamSchema.parse(req.params);
    await removeCommercialShoot(id);
    success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function listPublishedCommercialShootsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = publicCommercialShootListQuerySchema.parse(req.query);
    const data = await listPublishedCommercialShoots(query.page, query.pageSize);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminListCommercialShootPackagesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = commercialShootIdParamSchema.parse(req.params);
    const query = commercialShootPackageListQuerySchema.parse(req.query);
    const data = await listCommercialShootPackagesForAdmin(id, query.page, query.pageSize);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminCreateCommercialShootPackageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = commercialShootIdParamSchema.parse(req.params);
    const body = createCommercialShootPackageSchema.parse(req.body);
    const data = await createCommercialShootPackage(id, body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateCommercialShootPackageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, packageId } = commercialShootPackageIdParamSchema.parse(req.params);
    const body = updateCommercialShootPackageSchema.parse(req.body);
    const data = await updateCommercialShootPackageById(id, packageId, body);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteCommercialShootPackageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, packageId } = commercialShootPackageIdParamSchema.parse(req.params);
    await removeCommercialShootPackage(id, packageId);
    success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
