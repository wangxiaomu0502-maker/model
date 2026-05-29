import type { ContractKind } from "../admin/contract-templates.types";

/** C 端角色与须签署的模板类型（与 contract_templates.contract_kind 一致） */
export const CONTRACT_KIND_FOR_ROLE: Partial<Record<number, ContractKind>> = {
  /** 模特：平台与模特（kind 历史名 broker_model） */
  1: "broker_model",
  2: "platform_merchant",
  3: "platform_broker",
  4: "platform_agent"
};

export function contractKindAllowedForRole(role: number): ContractKind | null {
  return CONTRACT_KIND_FOR_ROLE[role] ?? null;
}

/** 小程序自主注册（模特/客户/经纪人） */
export const REGISTRATION_TARGET_ROLES = [1, 2, 3] as const;
export type RegistrationTargetRole = (typeof REGISTRATION_TARGET_ROLES)[number];

export function isRegistrationTargetRole(role: number): role is RegistrationTargetRole {
  return (REGISTRATION_TARGET_ROLES as readonly number[]).includes(role);
}

const SIGNED_AT_BY_KIND: Record<
  ContractKind,
  | "contract_platform_broker_signed_at"
  | "contract_platform_merchant_signed_at"
  | "contract_broker_model_signed_at"
  | "contract_platform_agent_signed_at"
> = {
  platform_broker: "contract_platform_broker_signed_at",
  platform_merchant: "contract_platform_merchant_signed_at",
  broker_model: "contract_broker_model_signed_at",
  platform_agent: "contract_platform_agent_signed_at"
};

export function isUserContractSigned(
  user: Record<string, unknown>,
  contractKind: ContractKind
): boolean {
  const at = user[SIGNED_AT_BY_KIND[contractKind]];
  return at != null && String(at).trim() !== "";
}
