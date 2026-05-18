import { z } from "zod";

export const merchantBasicInfoSchema = z.object({
  city: z.string().min(1)
});

