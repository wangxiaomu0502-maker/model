import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { getMerchantMeController, saveMerchantBasicInfoController } from "./merchant.controller";
import { merchantBasicInfoSchema } from "./merchant.types";

const merchantRouter = Router();

merchantRouter.get("/me", requireAuth, getMerchantMeController);
merchantRouter.put("/basic-info", requireAuth, validate(merchantBasicInfoSchema), saveMerchantBasicInfoController);

export default merchantRouter;

