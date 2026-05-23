import { NextFunction, Request, Response } from "express";

import { fail, success } from "../../core/http/response";
import { ErrorCodes } from "../../core/constants/error-codes";
import { handleWechatPayNotify } from "./pay.service";

export async function wechatPayNotifyController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : "";
    if (!rawBody) {
      fail(req, res, 400, { code: ErrorCodes.VALIDATION_ERROR, message: "empty body" });
      return;
    }

    const timestamp = String(req.header("wechatpay-timestamp") || "");
    const nonce = String(req.header("wechatpay-nonce") || "");
    const signature = String(req.header("wechatpay-signature") || "");
    const serial = String(req.header("wechatpay-serial") || "");

    await handleWechatPayNotify({
      rawBody,
      timestamp,
      nonce,
      signature,
      serial
    });

    res.status(200).json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    next(error);
  }
}

export function wechatPayNotifyHealthController(_req: Request, res: Response): void {
  success(res, { scope: "wechat-pay-notify" });
}
