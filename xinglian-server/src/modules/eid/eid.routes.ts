import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { createEidTokenController, verifyEidResultController } from "./eid.controller";
import { createEidTokenSchema, verifyEidResultSchema } from "./eid.dto";

const eidRouter = Router();

eidRouter.post("/token", requireAuth, validate(createEidTokenSchema), createEidTokenController);
eidRouter.post("/result", requireAuth, validate(verifyEidResultSchema), verifyEidResultController);

export default eidRouter;
