import { z } from "zod";

export const brokerBoundListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  keyword: z.string().trim().max(64).optional()
});

export type BrokerBoundListQuery = z.infer<typeof brokerBoundListQuerySchema>;

/** 经纪人关联订单列表 */
export const brokerOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.coerce.number().int().min(1).max(99).optional()
});

export type BrokerOrderListQuery = z.infer<typeof brokerOrderListQuerySchema>;
