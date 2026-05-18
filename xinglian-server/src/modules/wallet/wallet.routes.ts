import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { getWalletOverviewController } from "./wallet.controller";

const walletRouter = Router();

walletRouter.get("/", requireAuth, getWalletOverviewController);

export default walletRouter;
