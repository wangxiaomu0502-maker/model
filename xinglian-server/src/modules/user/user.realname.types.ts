import { z } from "zod";

/** 已绑定模特账号补做实名（不走过户注册，不重置资料审核状态） */
export const completeModelRealnameBodySchema = z.object({
  faceVerified: z.literal(true),
  realName: z.string().min(1).max(50),
  idCardNo: z.string().min(15).max(18),
  idCardFrontUrl: z.string().min(1).max(2048),
  idCardBackUrl: z.string().min(1).max(2048),
  idCardIssueAuthority: z.string().min(1).max(100),
  idCardValidDate: z.string().min(1).max(80)
});

export type CompleteModelRealnameBody = z.infer<typeof completeModelRealnameBodySchema>;
