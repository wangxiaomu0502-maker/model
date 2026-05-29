import type { ContractKind } from "../admin/contract-templates.types";

const CONTRACT_KIND_PREFIX: Record<ContractKind, string> = {
  platform_broker: "PB",
  platform_merchant: "PM",
  broker_model: "BM",
  platform_agent: "PA"
};

function shanghaiParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

export function formatContractDateCn(date: Date): string {
  const p = shanghaiParts(date);
  return `${p.year}年${p.month}月${p.day}日`;
}

export function formatContractDateTimeCn(date: Date): string {
  const p = shanghaiParts(date);
  return `${p.year}年${p.month}月${p.day}日 ${p.hour}:${p.minute}:${p.second}`;
}

export function formatSqlDateTime(date: Date): string {
  const p = shanghaiParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function generateContractNo(params: {
  contractKind: ContractKind;
  userNo: string;
  signedAt: Date;
}): string {
  const p = shanghaiParts(params.signedAt);
  const prefix = CONTRACT_KIND_PREFIX[params.contractKind];
  const userNo = String(params.userNo || "UNKNOWN").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return `XL-${prefix}-${p.year}${p.month}${p.day}-${userNo}`;
}

export function renderContractHtml(
  html: string,
  params: { contractNo: string; signedAt: Date }
): string {
  const dateText = formatContractDateCn(params.signedAt);
  return String(html || "")
    .replace(/协议编号[：:]\s*_+/g, `协议编号： ${params.contractNo}`)
    .replace(/签署日期[：:]\s*_+年\s*_+月\s*_+日/g, `签署日期： ${dateText}`)
    .replace(/签署日期[：:]\s*_+/g, `签署日期： ${dateText}`)
    .replace(/<p[^>]*>\s*签署时间[：:][\s\S]*?<\/p>/gi, "")
    .replace(/签署时间[：:]\s*_+/g, "");
}
