import { Router } from "express";

import { getMerchantOrderSettingController, getPlatformMaintenanceStatusController } from "./system-settings.controller";

const systemSettingsRouter = Router();

systemSettingsRouter.get("/merchant-order-setting", getMerchantOrderSettingController);
systemSettingsRouter.get("/platform-maintenance", getPlatformMaintenanceStatusController);

export default systemSettingsRouter;
