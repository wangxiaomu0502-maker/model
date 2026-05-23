import { isWechatPayConfigured, verifyAndDecryptPayNotify } from "../../integrations/wechat/pay/wechat-pay.client";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import { findOpenidByUserId } from "../auth/auth.repository";
import {
  findOrderByOrderNo,
  findOrderDetailRowById,
  markOrderPaidByOrderNo
} from "../order/order.repository";
import { appendPaymentOperationLogSafe } from "./payment-log.repository";

export async function handleWechatPayNotify(params: {
  rawBody: string;
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}): Promise<void> {
  try {
    const tx = verifyAndDecryptPayNotify(params);
    appendPaymentOperationLogSafe({
      eventType: "wechat_pay_notify",
      orderNo: tx.outTradeNo || null,
      wechatTransactionId: tx.transactionId || null,
      tradeState: tx.tradeState || null,
      direction: "callback",
      responseJson: {
        serial: params.serial,
        tradeState: tx.tradeState,
        outTradeNo: tx.outTradeNo,
        transactionId: tx.transactionId
      }
    });
    if (tx.tradeState !== "SUCCESS") {
      return;
    }
    if (!tx.outTradeNo) {
      throw new AppError("回调缺少商户订单号", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const order = await findOrderByOrderNo(tx.outTradeNo);
    if (!order) {
      throw new AppError("订单不存在", 404, ErrorCodes.NOT_FOUND);
    }
    if (Number(order.payment_status) === 1) {
      return;
    }
    const ok = await markOrderPaidByOrderNo(tx.outTradeNo, "wechat", tx.transactionId || null);
    if (!ok) {
      throw new AppError("更新订单支付状态失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  } catch (error) {
    appendPaymentOperationLogSafe({
      eventType: "wechat_pay_notify",
      direction: "callback",
      responseJson: { serial: params.serial },
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export { isWechatPayConfigured };
