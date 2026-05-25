import { z } from "zod";

import {
  basicInfoSchema,
  cardSchema,
  orderSettingsSchema,
  portfolioSchema,
  pricingSchema,
  scheduleSchema,
  stylePositionSchema
} from "../model/model.types";

const statusField = z.coerce
  .number()
  .int()
  .refine((n) => n === 1 || n === 2, { message: "status 须为 1（正常）或 2（禁用）" });

const pricingRequiredSchema = pricingSchema.superRefine((p, ctx) => {
  const ok = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  };
  if (!ok(p.hourly)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "请填写小时价", path: ["hourly"] });
  }
  if (!ok(p.halfDay)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "请填写半天价", path: ["halfDay"] });
  }
  if (!ok(p.fullDay)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "请填写全天价", path: ["fullDay"] });
  }
});

export const adminModelCreateBodySchema = z.object({
  avatarUrl: z.string().trim().max(2048).optional().nullable(),
  agentUserId: z.coerce.number().int().positive().optional().nullable(),
  status: statusField.default(1),
  basicInfo: basicInfoSchema,
  categoryIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "请至少选择 1 个模特分类"),
  card: cardSchema,
  portfolio: portfolioSchema.optional(),
  stylePosition: stylePositionSchema.optional(),
  pricing: pricingRequiredSchema,
  schedule: scheduleSchema.optional(),
  orderSettings: orderSettingsSchema
});

export type AdminModelCreateBody = z.infer<typeof adminModelCreateBodySchema>;
