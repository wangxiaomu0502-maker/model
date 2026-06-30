import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import {
  bindPhoneSchema,
  completeRegistrationSchema,
  platformBindModelSchema,
  registrationContractQuerySchema,
  signRegistrationContractSchema,
  wechatLoginSchema
} from "./auth.dto";
import {
  bindPhoneController,
  completeRegistrationController,
  deleteAccountController,
  getRegistrationContractController,
  platformBindModelController,
  signRegistrationContractController,
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
authRouter.get(
  "/registration-contract",
  requireAuth,
  validate(registrationContractQuerySchema, "query"),
  getRegistrationContractController
);
authRouter.post(
  "/sign-registration-contract",
  requireAuth,
  validate(signRegistrationContractSchema),
  signRegistrationContractController
);
authRouter.post(
  "/complete-registration",
  requireAuth,
  validate(completeRegistrationSchema),
  completeRegistrationController
);
authRouter.delete("/account", requireAuth, deleteAccountController);

export default authRouter;
