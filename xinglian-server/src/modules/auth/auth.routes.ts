import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  bindPhoneSchema,
  completeRegistrationSchema,
  platformBindModelSchema,
  wechatLoginSchema
} from "./auth.dto";
import {
  bindPhoneController,
  completeRegistrationController,
  deleteAccountController,
  platformBindModelController,
  wechatLoginController
} from "./auth.controller";

const authRouter = Router();

authRouter.post("/wechat/login", validate(wechatLoginSchema), wechatLoginController);
authRouter.post("/bind-phone", requireAuth, validate(bindPhoneSchema), bindPhoneController);
authRouter.post(
  "/model/platform-bind",
  requireAuth,
  validate(platformBindModelSchema),
  platformBindModelController
);
authRouter.post(
  "/complete-registration",
  requireAuth,
  validate(completeRegistrationSchema),
  completeRegistrationController
);
authRouter.delete("/account", requireAuth, deleteAccountController);

export default authRouter;
