import { Router } from "express";

import { wechatPayNotifyController } from "./pay.controller";

const payRouter = Router();

payRouter.post("/wechat/notify", wechatPayNotifyController);

export default payRouter;
