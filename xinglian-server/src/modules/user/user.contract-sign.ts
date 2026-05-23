import type { ContractKind } from "../admin/contract-templates.types";

/** C 端角色与须签署的模板类型（与 contract_templates.contract_kind 一致） */
export const CONTRACT_KIND_FOR_ROLE: Partial<Record<number, ContractKind>> = {
  1: "broker_model",
  2: "platform_merchant",
  3: "platform_broker",
  4: "platform_agent"
};

export function contractKindAllowedForRole(role: number): ContractKind | null {
  return CONTRACT_KIND_FOR_ROLE[role] ?? null;
}
