/** orders.cs_status：客服处理状态 */
export const CsOrderStatus = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3
} as const;

export type CsOrderStatusCode = (typeof CsOrderStatus)[keyof typeof CsOrderStatus];

export function csOrderStatusLabel(code: number): string {
  switch (code) {
    case CsOrderStatus.PENDING:
      return "待处理";
    case CsOrderStatus.PROCESSING:
      return "处理中";
    case CsOrderStatus.COMPLETED:
      return "已完成";
    default:
      return `未知(${code})`;
  }
}
