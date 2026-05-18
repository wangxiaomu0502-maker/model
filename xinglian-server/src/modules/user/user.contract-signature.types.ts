import { z } from "zod";

export const signContractBodySchema = z.object({
  signatureUrl: z.string().url().max(2048)
});
