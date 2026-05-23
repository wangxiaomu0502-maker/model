import { z } from "zod";

function issueBpWholePct(path: string, ctx: z.RefinementCtx): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message: "万分比须为 100 的倍数（仅支持整数百分比）"
  });
}

export const splitRulesUpdateSchema = z
  .object({
    serviceType: z.enum(["ordinary", "agent"]).default("ordinary"),
    platformFeeRateBp: z.number().int().min(0).max(10000),
    modelShareBp: z.number().int().min(0).max(10000),
    platformShareOfFeeBp: z.number().int().min(0).max(10000),
    agentShareOfFeeBp: z.number().int().min(0).max(10000),
    brokerShareOfFeeBp: z.number().int().min(0).max(10000)
  })
  .superRefine((data, ctx) => {
    for (const [key, val] of Object.entries(data).filter(([key]) => key !== "serviceType") as [string, number][]) {
      if (val % 100 !== 0) issueBpWholePct(key, ctx);
    }
    if (data.modelShareBp + data.platformFeeRateBp !== 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "模特收入占比 + 服务费占比 须等于 100%"
      });
    }
    const feeSum =
      data.platformShareOfFeeBp + data.agentShareOfFeeBp + data.brokerShareOfFeeBp;
    if (feeSum !== 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "服务费内：平台 + 代理人 + 经纪人 占比之和须为 100%"
      });
    }
  });

export type SplitRulesUpdateDto = z.infer<typeof splitRulesUpdateSchema>;
