import path from "node:path";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestContext } from "./middlewares/request-context";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import modelRouter from "./modules/model/model.routes";
import orderRouter from "./modules/order/order.routes";
import adminRouter from "./modules/admin/admin.routes";
import merchantRouter from "./modules/merchant/merchant.routes";
import contractRouter from "./modules/contract/contract.routes";
import userRouter from "./modules/user/user.routes";
import ocrRouter from "./modules/ocr/ocr.routes";
import eidRouter from "./modules/eid/eid.routes";
import brokerRouter from "./modules/broker/broker.routes";
import walletRouter from "./modules/wallet/wallet.routes";
import payRouter from "./modules/pay/pay.routes";
import systemSettingsRouter from "./modules/system-settings/system-settings.routes";
import commercialShootCenterRouter from "./modules/commercial-shoot-center/commercial-shoot-center.routes";
import searchRouter from "./modules/search/search.routes";

const app = express();

app.use(helmet());
/** 默认放行跨域；小程序 wx.request 不走浏览器 CORS。不要用 origin:true+credentials 组合，易在无 Origin 的请求上与 cors 内部逻辑冲突导致异常 */
app.use(cors());
/** 微信支付回调需原始 body 验签，须在 express.json() 之前注册 */
app.use("/api/pay/wechat/notify", express.raw({ type: "application/json" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(requestContext);
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    message: "Xinglian server is running"
  });
});

app.use("/api/health", healthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/orders", orderRouter);
app.use("/api/models", modelRouter);
app.use("/api/merchant", merchantRouter);
app.use("/api/contracts", contractRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/eid", eidRouter);
app.use("/api/broker", brokerRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/pay", payRouter);
app.use("/api/system-settings", systemSettingsRouter);
app.use("/api/commercial-shoots", commercialShootCenterRouter);
app.use("/api/search", searchRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;