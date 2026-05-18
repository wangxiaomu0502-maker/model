import { z } from "zod";

export const healthQuerySchema = z.object({
  verbose: z.coerce.boolean().optional()
});

export type HealthQueryDto = z.infer<typeof healthQuerySchema>;
