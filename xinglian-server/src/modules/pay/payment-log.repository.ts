import { dbPool } from "../../config/db";

export type PaymentOperationLogInput = {
  eventType: string;
  orderId?: number | null;
  orderNo?: string | null;
  refundNo?: string | null;
  wechatTransactionId?: string | null;
  wechatRefundId?: string | null;
  tradeState?: string | null;
  refundStatus?: string | null;
  direction?: "request" | "response" | "callback" | "internal";
  requestJson?: unknown;
  responseJson?: unknown;
  errorMessage?: string | null;
};

function jsonOrNull(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export async function appendPaymentOperationLog(input: PaymentOperationLogInput): Promise<void> {
  await dbPool.query(
    `INSERT INTO payment_operation_logs (
       event_type, order_id, order_no, refund_no,
       wechat_transaction_id, wechat_refund_id,
       trade_state, refund_status, direction,
       request_json, response_json, error_message
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.eventType,
      input.orderId ?? null,
      input.orderNo ?? null,
      input.refundNo ?? null,
      input.wechatTransactionId ?? null,
      input.wechatRefundId ?? null,
      input.tradeState ?? null,
      input.refundStatus ?? null,
      input.direction ?? "internal",
      jsonOrNull(input.requestJson),
      jsonOrNull(input.responseJson),
      input.errorMessage ?? null
    ]
  );
}

/** 日志失败不应影响支付主流程。 */
export function appendPaymentOperationLogSafe(input: PaymentOperationLogInput): void {
  void appendPaymentOperationLog(input).catch((error) => {
    console.warn("[payment-log] append failed", error);
  });
}
