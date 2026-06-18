import { Router } from "express";

import { optionalAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  getBrokerPublicDetailController,
  getMerchantPublicDetailController,
  searchUsersController
} from "./search.controller";
import { searchUserNoQuerySchema, searchUsersQuerySchema } from "./search.types";

const searchRouter = Router();

searchRouter.get(
  "/users",
  optionalAuth,
  validate(searchUsersQuerySchema, "query"),
  searchUsersController
);
searchRouter.get(
  "/broker",
  optionalAuth,
  validate(searchUserNoQuerySchema, "query"),
  getBrokerPublicDetailController
);
searchRouter.get(
  "/merchant",
  optionalAuth,
  validate(searchUserNoQuerySchema, "query"),
  getMerchantPublicDetailController
);

export default searchRouter;
