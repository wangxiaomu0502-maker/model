/** orders.order_status：待支付 | 待模特确认接单 | 进行中 | 模特已完成 | 已完成 | 已取消 */
export const OrderStatus = {
  /** 已下单未支付（微信支付模式） */
  AWAITING_PAYMENT: 0,
  /** 支付成功后的首态 */
  PENDING_MODEL_ACCEPT: 1,
  /** 模特已确认接单，履约中 */
  IN_PROGRESS: 2,
  /** 模特已确认服务完成，待商家确认 */
  MODEL_FINISHED: 3,
  /** 商家已确认服务完成，归档 */
  COMPLETED: 4,
  CANCELLED: 9
} as const;

export type OrderStatusCode = (typeof OrderStatus)[keyof typeof OrderStatus];

export function orderStatusLabel(code: number): string {
  switch (code) {
    case OrderStatus.AWAITING_PAYMENT:
      return "待支付";
    case OrderStatus.PENDING_MODEL_ACCEPT:
      return "待模特确认接单";
    case OrderStatus.IN_PROGRESS:
      return "进行中";
    case OrderStatus.MODEL_FINISHED:
      return "模特已完成";
    case OrderStatus.COMPLETED:
      return "已完成";
    case OrderStatus.CANCELLED:
      return "已取消";
    default:
      return `未知状态(${code})`;
  }
}

export function durationKindLabel(kind: string): string {
  if (kind === "full_day") return "全天";
  if (kind === "half_day") return "半天";
  if (kind === "hourly") return "按小时";
  return kind;
}

/** orders.payment_status */
export function paymentStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return "未支付";
    case 1:
      return "已支付";
    case 2:
      return "退款中";
    case 3:
      return "已退款";
    case 4:
      return "退款失败";
    default:
      return `支付${code}`;
  }
}
