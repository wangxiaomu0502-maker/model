import type { ContractKind } from "./contract-templates.types";

/** 固定顺序（列表 / 筛选用） */
export const CONTRACT_KIND_ORDER: ContractKind[] = [
  "platform_broker",
  "platform_merchant",
  "broker_model",
  "platform_agent"
];

/** 展示文案（不与 DB title 混用：title 为合同标题可编辑） */
export const CONTRACT_KIND_LABELS: Record<
  ContractKind,
  { label: string; partiesLine: string }
> = {
  platform_broker: {
    label: "平台与经纪人",
    partiesLine: "平台和经纪人订立，由经纪人签署"
  },
  platform_merchant: {
    label: "平台与商家",
    partiesLine: "平台和商家订立，由商家签署"
  },
  broker_model: {
    label: "经纪人与模特",
    partiesLine: "经纪人和模特订立，由模特签署"
  },
  platform_agent: {
    label: "平台与代理人",
    partiesLine: "平台和代理人订立，由代理人签署"
  }
};
