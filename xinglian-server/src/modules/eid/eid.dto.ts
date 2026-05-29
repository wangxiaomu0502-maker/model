import { z } from "zod";

export const createEidTokenSchema = z.object({
  realName: z.string().trim().min(1).max(32),
  idCardNo: z.string().trim().min(15).max(32)
});

export const verifyEidResultSchema = z.object({
  eidToken: z.string().trim().min(1).max(128),
  realName: z.string().trim().min(1).max(32),
  idCardNo: z.string().trim().min(15).max(32)
});

export type CreateEidTokenBody = z.infer<typeof createEidTokenSchema>;
export type VerifyEidResultBody = z.infer<typeof verifyEidResultSchema>;
