import { z } from "zod";

export const wechatLoginSchema = z.object({
  code: z.string().min(1)
});

export const bindPhoneSchema = z.object({
  code: z.string().min(1)
});

/** 允许缺省转空串，统一在 superRefine 中给出业务字段错误 */
const trimMax = (max: number) =>
  z.preprocess(
    (val) => (val === undefined || val === null ? "" : String(val)).trim(),
    z.string().max(max)
  );

export const completeRegistrationSchema = z
  .object({
    role: z.number().int().optional(),
    identity: z.string().optional(),
    phone: z.string().min(1),
    faceVerified: z.boolean().optional(),
    nickname: z.string().trim().min(1).max(50),
    avatarUrl: z.string().trim().min(1).max(512),
    realName: trimMax(50),
    idCardNo: trimMax(22),
    idCardFrontUrl: trimMax(512),
    idCardBackUrl: trimMax(512),
    idCardIssueAuthority: trimMax(120),
    idCardValidDate: trimMax(64),
    /** 经纪人推广链接携带的转介绍码（平台用户 ID / user_no） */
    brokerUserNo: trimMax(64).optional()
  })
  .refine((value) => value.role !== undefined || value.identity !== undefined, {
    message: "role or identity is required"
  })
  .superRefine((value, ctx) => {
    if (!value.realName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "real name required", path: ["realName"] });
    }
    if (!value.idCardNo || value.idCardNo.length < 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid id card number",
        path: ["idCardNo"]
      });
    }
    if (!value.idCardFrontUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "id card front required",
        path: ["idCardFrontUrl"]
      });
    }
    if (!value.idCardBackUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "id card back required",
        path: ["idCardBackUrl"]
      });
    }
    if (!value.idCardIssueAuthority) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "issue authority required",
        path: ["idCardIssueAuthority"]
      });
    }
    if (!value.idCardValidDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "valid date required",
        path: ["idCardValidDate"]
      });
    }
  });
