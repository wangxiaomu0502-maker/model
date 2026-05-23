import { NextFunction, Request, Response } from "express";

import { success } from "../../core/http/response";

import {
  createCsUserSchema,
  csUserIdParamSchema,
  csUserListQuerySchema,
  updateCsUserSchema
} from "./admin-cs-user.types";
import { createCsUser, listCsUsers, removeCsUser, updateCsUser } from "./admin-cs-user.service";

export async function listCsUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = csUserListQuerySchema.parse(req.query);
    const data = await listCsUsers(query.page, query.pageSize);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createCsUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createCsUserSchema.parse(req.body);
    const data = await createCsUser({
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      phone: body.phone,
      status: body.status
    });
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function updateCsUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = csUserIdParamSchema.parse(req.params);
    const body = updateCsUserSchema.parse(req.body);
    const data = await updateCsUser(id, {
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      phone: body.phone,
      status: body.status
    });
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteCsUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = csUserIdParamSchema.parse(req.params);
    await removeCsUser(id);
    success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}
