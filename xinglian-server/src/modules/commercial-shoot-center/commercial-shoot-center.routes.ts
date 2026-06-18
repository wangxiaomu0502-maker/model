import { Router } from "express";

import { validate } from "../../middlewares/validate";

import { listPublishedCommercialShootsController } from "./commercial-shoot-center.controller";
import { publicCommercialShootListQuerySchema } from "./commercial-shoot-center.types";

const commercialShootCenterRouter = Router();

commercialShootCenterRouter.get(
  "/",
  validate(publicCommercialShootListQuerySchema, "query"),
  listPublishedCommercialShootsController
);

export default commercialShootCenterRouter;
