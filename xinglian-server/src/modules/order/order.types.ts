import { z } from "zod";

export const quoteSchema = z.object({
  durationHours: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  platformFeeRate: z.number().min(0).max(1).default(0.15)
});

export type QuoteDto = z.infer<typeof quoteSchema>;

export const createOrderSchema = z
  .object({
    modelUserNo: z.string().trim().min(1),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceType: z.enum(["ordinary", "agent"]).default("ordinary"),
    durationKind: z.enum(["fullDay", "halfDay", "hourly"]),
    hourCount: z.coerce.number().int().min(1).max(8).optional()
  })
  .superRefine((data, ctx) => {
    if (data.durationKind === "hourly" && data.hourCount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "hourCount is required when durationKind is hourly",
        path: ["hourCount"]
      });
    }
  });

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive()
});

export type OrderIdParams = z.infer<typeof orderIdParamSchema>;

/** 商家/模特取消订单均须填写 reason（至少 2 字） */
export const cancelOrderBodySchema = z.preprocess(
  (v) => (v == null || typeof v !== "object" ? {} : v),
  z.object({
    reason: z.string().max(500).optional()
  })
);

export type CancelOrderBody = z.infer<typeof cancelOrderBodySchema>;

/** 我的订单列表查询（商家 role=2 / 模特 role=1） */
export const listMineOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  /** 可选：按 orders.order_status 精确筛选（1/2/3/4/9） */
  status: z.coerce.number().int().min(1).max(99).optional()
});

export type ListMineOrdersQuery = z.infer<typeof listMineOrdersQuerySchema>;
