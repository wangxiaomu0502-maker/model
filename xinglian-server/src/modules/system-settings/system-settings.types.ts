import { z } from "zod";

export const systemSettingsUpdateSchema = z.object({
  merchantOrderEnabled: z.boolean(),
  platformMaintenanceEnabled: z.boolean(),
  platformMaintenanceMessage: z.string().max(255),
  homeStatModelOffset: z.number().int(),
  homeStatMerchantOffset: z.number().int(),
  homeStatBrokerOffset: z.number().int()
});

export type SystemSettingsUpdateDto = z.infer<typeof systemSettingsUpdateSchema>;
