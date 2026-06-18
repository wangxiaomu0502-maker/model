import { z } from "zod";

export const searchUsersQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

export const searchUserNoQuerySchema = z.object({
  userNo: z.string().trim().min(1).max(32)
});
