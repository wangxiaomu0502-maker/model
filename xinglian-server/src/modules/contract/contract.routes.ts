import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { publicGetContractTemplateController } from "../admin/contract-templates.controller";
import { contractKindParamSchema } from "../admin/contract-templates.types";
import {
  getMyContractController,
  signMyContractController,
  uploadContractSignatureController
} from "../user/user.controller";
import { contractSignatureUploader } from "../user/user.contract-signature.middleware";
import { signContractBodySchema } from "../user/user.contract-signature.types";

const contractRouter = Router();

contractRouter.get(
  "/templates/:contractKind",
  validate(contractKindParamSchema, "params"),
  publicGetContractTemplateController
);

contractRouter.get(
  "/:contractKind/my",
  requireAuth,
  validate(contractKindParamSchema, "params"),
  getMyContractController
);

/** 与 GET /templates/:kind 同挂载前缀，便于小程序共用域名路径；逻辑同 POST /api/users/me/contracts/:contractKind/sign */
contractRouter.post(
  "/:contractKind/sign",
  requireAuth,
  validate(contractKindParamSchema, "params"),
  validate(signContractBodySchema),
  signMyContractController
);

contractRouter.post(
  "/signature/upload",
  requireAuth,
  contractSignatureUploader.single("file"),
  uploadContractSignatureController
);

export default contractRouter;
