import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { contractKindParamSchema } from "../admin/contract-templates.types";
import { signContractBodySchema } from "./user.contract-signature.types";
import { updateNicknameBodySchema } from "./user.nickname.types";
import { completeModelRealnameBodySchema } from "./user.realname.types";

import { avatarUploader } from "./user.avatar.middleware";
import { brokerLicenseUploader } from "./user.broker-license.middleware";
import { contractSignatureUploader } from "./user.contract-signature.middleware";

import {
  completeModelRealnameController,
  getMeController,
  signMyContractController,
  updateNicknameController,
  uploadAvatarController,
  uploadBrokerLicenseController,
  uploadContractSignatureController
} from "./user.controller";
import { getWalletOverviewController } from "../wallet/wallet.controller";

const userRouter = Router();

userRouter.post(
  "/me/avatar",
  requireAuth,
  avatarUploader.single("file"),
  uploadAvatarController
);
userRouter.post(
  "/me/broker-license",
  requireAuth,
  brokerLicenseUploader.single("file"),
  uploadBrokerLicenseController
);
userRouter.get("/me", requireAuth, getMeController);
userRouter.post(
  "/me/realname-verify",
  requireAuth,
  validate(completeModelRealnameBodySchema),
  completeModelRealnameController
);
userRouter.patch(
  "/me/nickname",
  requireAuth,
  validate(updateNicknameBodySchema),
  updateNicknameController
);
/** 与 GET /api/wallet 等价，便于网关/前端统一走 users 前缀 */
userRouter.get("/me/wallet", requireAuth, getWalletOverviewController);
userRouter.post(
  "/me/contracts/:contractKind/sign",
  requireAuth,
  validate(contractKindParamSchema, "params"),
  validate(signContractBodySchema),
  signMyContractController
);
userRouter.post(
  "/me/contracts/signature/upload",
  requireAuth,
  contractSignatureUploader.single("file"),
  uploadContractSignatureController
);

export default userRouter;
