import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { contractKindParamSchema } from "../admin/contract-templates.types";
import { signContractBodySchema } from "./user.contract-signature.types";

import { avatarUploader } from "./user.avatar.middleware";
import { contractSignatureUploader } from "./user.contract-signature.middleware";
import { putMyReferrerBodySchema, type PutMyReferrerBody } from "./user.referrer.types";

import {
  getMeController,
  putMyReferrerController,
  signMyContractController,
  uploadAvatarController,
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
userRouter.get("/me", requireAuth, getMeController);
/** 与 GET /api/wallet 等价，便于网关/前端统一走 users 前缀 */
userRouter.get("/me/wallet", requireAuth, getWalletOverviewController);
userRouter.put(
  "/me/referrer",
  requireAuth,
  validate(putMyReferrerBodySchema),
  putMyReferrerController
);
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
