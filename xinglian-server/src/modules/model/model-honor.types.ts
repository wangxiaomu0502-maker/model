import { z } from "zod";

export const modelHonorIdParamSchema = z.object({
  honorId: z.coerce.number().int().positive()
});

export const modelHonorCreateBodySchema = z.object({
  title: z.string().trim().min(1, "荣誉名称不能为空").max(100),
  imageUrl: z.string().trim().max(512).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional()
});

export const modelHonorUpdateBodySchema = z.object({
  title: z.string().trim().min(1, "荣誉名称不能为空").max(100).optional(),
  imageUrl: z.string().trim().max(512).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional()
});

export type ModelHonorCreateBody = z.infer<typeof modelHonorCreateBodySchema>;
export type ModelHonorUpdateBody = z.infer<typeof modelHonorUpdateBodySchema>;

export type ModelHonorDto = {
  id: number;
  title: string;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
