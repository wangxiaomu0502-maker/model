import { NextFunction, Request, Response } from "express";

import { success } from "../../core/http/response";

import {
  generateModelRegistrationCodesForAdmin,
  listModelRegistrationCodesForAdmin,
  verifyModelRegistrationCodeForMiniapp
} from "./model-registration-code.service";
import {
  modelRegistrationCodeGenerateBodySchema,
  modelRegistrationCodeListQuerySchema,
  verifyModelRegistrationCodeSchema
} from "./model-registration-code.types";

export async function adminListModelRegistrationCodesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = modelRegistrationCodeListQuerySchema.parse(req.query);
    const data = await listModelRegistrationCodesForAdmin(query);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function adminGenerateModelRegistrationCodesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = modelRegistrationCodeGenerateBodySchema.parse(req.body ?? {});
    const data = await generateModelRegistrationCodesForAdmin(body.count);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function verifyModelRegistrationCodeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = verifyModelRegistrationCodeSchema.parse(req.body ?? {});
    const data = await verifyModelRegistrationCodeForMiniapp(body.code);
    success(res, data);
  } catch (error) {
    next(error);
  }
}
