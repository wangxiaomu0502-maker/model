import { z } from "zod";

export const CONTRACT_KIND_VALUES = [
  "platform_broker",
  "platform_merchant",
  "broker_model",
  "platform_agent"
] as const;

export type ContractKind = (typeof CONTRACT_KIND_VALUES)[number];

export const contractKindParamSchema = z.object({
  contractKind: z.enum(CONTRACT_KIND_VALUES)
});

export const contractTemplateUpdateBodySchema = z.object({
  title: z.string().max(200),
  contentHtml: z.string().max(600_000)
});

export type ContractTemplateUpdateBody = z.infer<typeof contractTemplateUpdateBodySchema>;
