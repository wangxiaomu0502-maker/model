import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import { CONTRACT_KIND_LABELS, CONTRACT_KIND_ORDER } from "./contract-templates.metadata";
import {
  findContractTemplateByKind,
  insertDefaultContractTemplates,
  listContractTemplatesOrdered,
  updateContractTemplateByKind
} from "./contract-templates.repository";
import type { ContractKind } from "./contract-templates.types";
import type { ContractTemplateUpdateBody } from "./contract-templates.types";

const MAX_HTML_CHARS = 600_000;

/**
 * 历史数据常见：建表/导入时 mysql 客户端为 latin1，UTF-8 中文按字节落库，读出来是西欧字符乱码。
 * 仅在「原文无汉字且 latin1→utf8 后像正常中文」时还原，避免误伤已是正确 UTF-8 的标题。
 */
function repairContractTitleMojibake(title: string): string {
  if (!title || typeof title !== "string") return title;
  if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(title)) return title;

  let highLatin = 0;
  for (let i = 0; i < title.length; i++) {
    const c = title.charCodeAt(i);
    if (c >= 0x80 && c <= 0xff) highLatin += 1;
  }
  if (highLatin < 2) return title;

  let decoded: string;
  try {
    decoded = Buffer.from(title, "latin1").toString("utf8");
  } catch {
    return title;
  }
  if (decoded.includes("\uFFFD")) return title;
  if (!/[\u3400-\u9FFF\uF900-\uFAFF]/.test(decoded)) return title;
  if (decoded.length > 200) return title;

  return decoded;
}

/** 管理端保存前基础净化（防 script / 事件处理器等；详细风控可后续接入 sanitize-html） */
export function sanitizeContractHtml(html: string): string {
  let s = typeof html === "string" ? html.trim() : "";
  if (s.length > MAX_HTML_CHARS) {
    throw new AppError("合同正文过长", 400, ErrorCodes.VALIDATION_ERROR);
  }
  s = s.replace(/<\/(?:script|style)[^>]*>/gi, "");
  s = s.replace(/<(?:script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed)>/gi, "");
  s = s.replace(/<(?:script|style|iframe|object|embed)[^/>]*\/?>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  return s;
}

export async function ensureContractTemplatesSeed(): Promise<void> {
  await insertDefaultContractTemplates();
}

function toIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function rowToPublicDto(row: {
  contract_kind: string;
  title: string;
  content_html: string;
  updated_at: Date | string;
}): Record<string, unknown> {
  return {
    contractKind: row.contract_kind,
    title: repairContractTitleMojibake(row.title),
    contentHtml: row.content_html,
    updatedAt: toIso(row.updated_at)
  };
}

export async function listContractTemplatesForAdmin(): Promise<Record<string, unknown>> {
  await ensureContractTemplatesSeed();
  const rows = await listContractTemplatesOrdered();
  const byKind = new Map(rows.map((r) => [r.contract_kind, r]));
  const list = CONTRACT_KIND_ORDER.map((kind) => {
    const row = byKind.get(kind);
    const meta = CONTRACT_KIND_LABELS[kind];
    if (!row) {
      throw new AppError(`contract template missing: ${kind}`, 500, ErrorCodes.INTERNAL_ERROR);
    }
    const dto = rowToPublicDto(row);
    return {
      contractKind: kind,
      label: meta.label,
      partiesLine: meta.partiesLine,
      title: dto.title as string,
      contentHtml: dto.contentHtml as string,
      updatedAt: dto.updatedAt as string
    };
  });
  return { list };
}

export async function updateContractTemplateForAdmin(
  kind: ContractKind,
  body: ContractTemplateUpdateBody
): Promise<Record<string, unknown>> {
  await ensureContractTemplatesSeed();
  const safeHtml = sanitizeContractHtml(body.contentHtml);
  const ok = await updateContractTemplateByKind(kind, {
    title: body.title.trim(),
    contentHtml: safeHtml
  });
  if (!ok) {
    throw new AppError("合同模板不存在或更新失败", 404, ErrorCodes.NOT_FOUND);
  }
  const row = await findContractTemplateByKind(kind);
  if (!row) {
    throw new AppError("contract template not found after update", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const meta = CONTRACT_KIND_LABELS[kind];
  return {
    contractKind: kind,
    label: meta.label,
    partiesLine: meta.partiesLine,
    ...rowToPublicDto(row)
  };
}

export async function getContractTemplatePublic(kind: ContractKind): Promise<Record<string, unknown>> {
  await ensureContractTemplatesSeed();
  const row = await findContractTemplateByKind(kind);
  if (!row) {
    throw new AppError("合同模板不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const meta = CONTRACT_KIND_LABELS[kind];
  return {
    ...rowToPublicDto(row),
    label: meta.label,
    partiesLine: meta.partiesLine
  };
}
