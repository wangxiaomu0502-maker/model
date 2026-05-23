import type { SplitRulesRow } from "../admin/split-rules.repository";

/** 与 orders.split_rules_snapshot 存库结构一致（v2） */
export type OrderSplitRulesSnapshotV2 = {
  version: "v2";
  service_type?: "ordinary" | "agent";
  model_share_bp: number;
  platform_fee_rate_bp: number;
  platform_share_of_fee_bp: number;
  agent_share_of_fee_bp: number;
  broker_share_of_fee_bp: number;
  rules_updated_at?: string;
};

export function buildSplitRulesSnapshotJson(rules: SplitRulesRow): string {
  const payload: OrderSplitRulesSnapshotV2 = {
    version: "v2",
    service_type: rules.service_type === "agent" ? "agent" : "ordinary",
    model_share_bp: Number(rules.model_share_bp),
    platform_fee_rate_bp: Number(rules.platform_fee_rate_bp),
    platform_share_of_fee_bp: Number(rules.platform_share_of_fee_bp),
    agent_share_of_fee_bp: Number(rules.agent_share_of_fee_bp),
    broker_share_of_fee_bp: Number(rules.broker_share_of_fee_bp),
    rules_updated_at:
      rules.updated_at instanceof Date
        ? rules.updated_at.toISOString()
        : String(rules.updated_at ?? "")
  };
  return JSON.stringify(payload);
}

function isLegacyV1(o: Record<string, unknown>): boolean {
  return (
    o.broker_share_of_fee_bp != null &&
    o.agent_share_of_fee_bp != null &&
    o.version !== "v2"
  );
}

/** 将 v1 快照近似映射为 v2（仅用于历史订单只读展示；新单均 v2） */
function legacyV1ToRow(o: Record<string, unknown>): SplitRulesRow | null {
  const m = Number(o.model_share_bp);
  const r = Number(o.platform_fee_rate_bp);
  const s = Number(o.broker_share_of_fee_bp);
  const t = Number(o.agent_share_of_fee_bp);
  if (![m, r, s, t].every((n) => Number.isFinite(n))) return null;
  const serviceBp = 10000 - m;
  return {
    id: 1,
    service_type: "ordinary",
    platform_fee_rate_bp: r,
    model_share_bp: m,
    platform_share_of_fee_bp: Math.round((Number(o.platform_share_of_fee_bp) || 3400)),
    agent_share_of_fee_bp: Math.round((t / (s + t || 1)) * 10000) || 3300,
    broker_share_of_fee_bp: Math.round((s / (s + t || 1)) * 10000) || 3300,
    remark: null,
    updated_at: new Date()
  } as SplitRulesRow;
}

/**
 * 解析订单分账规则快照；无快照或格式不对返回 null。
 */
export function parseOrderSplitRulesSnapshot(row: {
  split_rules_snapshot?: unknown;
}): SplitRulesRow | null {
  const raw = row.split_rules_snapshot;
  if (raw == null || raw === "") return null;

  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    o = raw as Record<string, unknown>;
  } else {
    return null;
  }

  if (isLegacyV1(o)) {
    return legacyV1ToRow(o);
  }

  const m = Number(o.model_share_bp);
  const r = Number(o.platform_fee_rate_bp);
  const pf = Number(o.platform_share_of_fee_bp);
  const af = Number(o.agent_share_of_fee_bp);
  const bf = Number(o.broker_share_of_fee_bp);
  if (![m, r, pf, af, bf].every((n) => Number.isFinite(n))) {
    return null;
  }

  return {
    id: 1,
    service_type: o.service_type === "agent" ? "agent" : "ordinary",
    platform_fee_rate_bp: r,
    model_share_bp: m,
    platform_share_of_fee_bp: pf,
    agent_share_of_fee_bp: af,
    broker_share_of_fee_bp: bf,
    remark: null,
    updated_at: new Date()
  } as SplitRulesRow;
}
