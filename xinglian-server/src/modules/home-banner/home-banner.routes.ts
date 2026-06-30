import { Router } from "express";

import { validate } from "../../middlewares/validate";

import {
  getPublishedHomeBannerController,
  listPublishedHomeBannersController
} from "./home-banner.controller";
import { homeBannerIdParamSchema } from "./home-banner.types";

const homeBannerRouter = Router();

homeBannerRouter.get("/", listPublishedHomeBannersController);
homeBannerRouter.get(
  "/:id",
  validate(homeBannerIdParamSchema, "params"),
  getPublishedHomeBannerController
);

export default homeBannerRouter;
