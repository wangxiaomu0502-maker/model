import { z } from "zod";

export const systemSettingsUpdateSchema = z.object({
  merchantOrderEnabled: z.boolean()
});

export type SystemSettingsUpdateDto = z.infer<typeof systemSettingsUpdateSchema>;
