import { z } from "zod";

export const csUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

const phoneSchema = z
  .string()
  .trim()
  .min(1, "请填写客服手机号")
  .max(20)
  .regex(/^1\d{10}$/, "请输入11位手机号");

export const createCsUserSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().max(64).optional().nullable(),
  phone: phoneSchema,
  status: z.coerce.number().int().min(0).max(1).default(1)
});

export const updateCsUserSchema = z
  .object({
    username: z.string().trim().min(2).max(64).optional(),
    password: z.string().min(6).max(128).optional(),
    displayName: z.string().trim().max(64).optional().nullable(),
    phone: phoneSchema.optional(),
    status: z.coerce.number().int().min(0).max(1).optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: "至少提供一个字段" });

export const csUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
