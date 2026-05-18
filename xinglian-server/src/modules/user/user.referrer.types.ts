import { z } from "zod";

/**
 * 绑定/解绑转介绍经纪人。
 * `brokerUserNo`：12 位经纪人对外 ID（users.user_no）；空字符串表示解除绑定。
 */
export const putMyReferrerBodySchema = z.object({
  brokerUserNo: z.string().max(32).default("").transform((s) => String(s).trim())
});

export type PutMyReferrerBody = z.infer<typeof putMyReferrerBodySchema>;
