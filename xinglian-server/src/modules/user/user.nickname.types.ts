import { z } from "zod";

export const updateNicknameBodySchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空").max(50, "昵称最多 50 字")
});

export type UpdateNicknameBody = z.infer<typeof updateNicknameBodySchema>;
