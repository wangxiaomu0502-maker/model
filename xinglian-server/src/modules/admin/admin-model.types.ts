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

const updateStatusField = z.coerce
  .number()
  .int()
  .refine((n) => n === 1 || n === 2 || n === 4, {
    message: "status 须为 1（正常）、2（禁用）或 4（已注销）"
  });

const adminCardPhotoAnglesSchema = z
  .array(
    z.object({
      key: z.string(),
      label: z.string().optional(),
      required: z.boolean().optional(),
      url: z.string().optional(),
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional()
    })
  )
  .default([]);

const adminCardMeasurementsSchema = cardSchema.shape.measurements.partial();

/** 后管创建：模卡可为空，不强制至少 1 张照片 */
const adminModelCardSchema = z.object({
  photoAngles: adminCardPhotoAnglesSchema,
  measurements: adminCardMeasurementsSchema.optional(),
  hairColor: z.string().min(1).optional(),
  skinColor: z.string().min(1).optional()
});

export const adminModelCreateBodySchema = z.object({
  avatarUrl: z.string().trim().max(2048).optional().nullable(),
  agentUserId: z.coerce.number().int().positive().optional().nullable(),
  status: statusField.default(1),
  basicInfo: basicInfoSchema,
  categoryIds: z.array(z.coerce.number().int().positive()).default([]),
  card: adminModelCardSchema.optional(),
  portfolio: portfolioSchema.optional(),
  stylePosition: stylePositionSchema.optional(),
  pricing: pricingSchema.optional(),
  schedule: scheduleSchema.optional(),
  orderSettings: orderSettingsSchema.optional()
});

export type AdminModelCreateBody = z.infer<typeof adminModelCreateBodySchema>;

export const adminModelUpdateBodySchema = adminModelCreateBodySchema.extend({
  status: updateStatusField
});

export type AdminModelUpdateBody = z.infer<typeof adminModelUpdateBodySchema>;
