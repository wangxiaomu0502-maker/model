import { Router } from "express";

import { getMerchantOrderSettingController } from "./system-settings.controller";

const systemSettingsRouter = Router();

systemSettingsRouter.get("/merchant-order-setting", getMerchantOrderSettingController);

export default systemSettingsRouter;
