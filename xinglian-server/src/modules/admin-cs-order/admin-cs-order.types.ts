import { z } from "zod";

import { CsOrderStatus } from "../order/order-cs-status";

export const csPendingOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  csStatus: z.coerce
    .number()
    .int()
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        [CsOrderStatus.PENDING, CsOrderStatus.PROCESSING, CsOrderStatus.COMPLETED].includes(
          v as (typeof CsOrderStatus)[keyof typeof CsOrderStatus]
        ),
      { message: "无效的客服状态" }
    )
});

export const csOrderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive()
});

export const csOrderNoteBodySchema = z.object({
  content: z.string().trim().min(1).max(2000)
});
