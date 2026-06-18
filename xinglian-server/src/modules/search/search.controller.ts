import { NextFunction, Request, Response } from "express";

import { success } from "../../core/http/response";
import {
  getBrokerPublicDetail,
  getMerchantPublicDetail,
  searchUsersByKeyword
} from "./search.service";
import { searchUserNoQuerySchema, searchUsersQuerySchema } from "./search.types";

export async function searchUsersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = searchUsersQuerySchema.parse(req.query);
    const data = await searchUsersByKeyword(query.keyword, query.limit);
    success(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getBrokerPublicDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userNo } = searchUserNoQuerySchema.parse(req.query);
    const data = await getBrokerPublicDetail(userNo);
    success(res, { broker: data });
  } catch (error) {
    next(error);
  }
}

export async function getMerchantPublicDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userNo } = searchUserNoQuerySchema.parse(req.query);
    const data = await getMerchantPublicDetail(userNo);
    success(res, { merchant: data });
  } catch (error) {
    next(error);
  }
}
