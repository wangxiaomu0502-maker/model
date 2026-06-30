import { z } from "zod";

export const homeBannerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const homeBannerIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const urlField = z.string().trim().url("链接格式不正确").max(1000);

const homeBannerBaseSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  enabled: z.coerce.boolean().optional().default(true),
  coverUrl: urlField
});

export const createHomeBannerSchema = z.discriminatedUnion("type", [
  homeBannerBaseSchema.extend({
    type: z.literal("image"),
    imageUrl: urlField
  }),
  homeBannerBaseSchema.extend({
    type: z.literal("video"),
    videoUrl: urlField
  })
]);

export const updateHomeBannerSchema = z.discriminatedUnion("type", [
  homeBannerBaseSchema.extend({
    type: z.literal("image"),
    imageUrl: urlField
  }),
  homeBannerBaseSchema.extend({
    type: z.literal("video"),
    videoUrl: urlField
  })
]);

export type CreateHomeBannerInput = z.infer<typeof createHomeBannerSchema>;
export type UpdateHomeBannerInput = z.infer<typeof updateHomeBannerSchema>;
