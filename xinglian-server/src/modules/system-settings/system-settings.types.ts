import { z } from "zod";

export const systemSettingsUpdateSchema = z.object({
  merchantOrderEnabled: z.boolean(),
  homeStatModelOffset: z.number().int(),
  homeStatMerchantOffset: z.number().int(),
  homeStatBrokerOffset: z.number().int()
});

export type SystemSettingsUpdateDto = z.infer<typeof systemSettingsUpdateSchema>;
