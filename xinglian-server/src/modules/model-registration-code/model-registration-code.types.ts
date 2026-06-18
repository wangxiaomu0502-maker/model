import { z } from "zod";

export const MODEL_REGISTRATION_CODE_LENGTH = 8;

export const modelRegistrationCodeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["all", "unused", "used"]).default("all")
});

export type ModelRegistrationCodeListQuery = z.infer<typeof modelRegistrationCodeListQuerySchema>;

export const modelRegistrationCodeGenerateBodySchema = z.object({
  count: z.coerce.number().int().min(1).max(5000).default(1000)
});

export type ModelRegistrationCodeGenerateBody = z.infer<typeof modelRegistrationCodeGenerateBodySchema>;

export const verifyModelRegistrationCodeSchema = z.object({
  code: z
    .preprocess((val) => (val === undefined || val === null ? "" : String(val)).trim(), z.string())
    .refine((v) => /^[0-9A-Za-z]{8}$/.test(v), {
      message: "invalid registration code"
    })
});

export type VerifyModelRegistrationCodeBody = z.infer<typeof verifyModelRegistrationCodeSchema>;

export type ModelRegistrationCodeRow = {
  id: number;
  code: string;
  usedByUserId: number | null;
  usedAt: string | null;
  createdAt: string;
};
