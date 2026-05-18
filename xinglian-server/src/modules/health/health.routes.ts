import { Router } from "express";

import { validate } from "../../middlewares/validate";
import { healthController, healthDbController } from "./health.controller";
import { healthQuerySchema } from "./health.types";

const healthRouter = Router();

healthRouter.get("/", validate(healthQuerySchema, "query"), healthController);
healthRouter.get("/db", healthDbController);

export default healthRouter;
