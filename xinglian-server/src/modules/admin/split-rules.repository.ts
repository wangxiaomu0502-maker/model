import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../config/db";

export type SplitRulesRow = RowDataPacket & {
  id: number;
  service_type: "ordinary" | "agent";
  platform_fee_rate_bp: number;
  model_share_bp: number;
  platform_share_of_fee_bp: number;
  agent_share_of_fee_bp: number;
  broker_share_of_fee_bp: number;
  remark: string | null;
  updated_at: Date;
};

export type SplitServiceType = "ordinary" | "agent";

export function normalizeSplitServiceType(value: unknown): SplitServiceType {
  return value === "agent" ? "agent" : "ordinary";
}

export async function findSplitRulesByServiceType(serviceType: SplitServiceType): Promise<SplitRulesRow | null> {
  const [rows] = await dbPool.query<SplitRulesRow[]>(
    `SELECT id, service_type, platform_fee_rate_bp, model_share_bp,
            platform_share_of_fee_bp, agent_share_of_fee_bp, broker_share_of_fee_bp,
            remark, updated_at
     FROM platform_split_rules WHERE service_type = ? LIMIT 1`,
    [serviceType]
  );
  return rows[0] ?? null;
}

export async function findSplitRulesById(id: number): Promise<SplitRulesRow | null> {
  const [rows] = await dbPool.query<SplitRulesRow[]>(
    `SELECT id, COALESCE(service_type, 'ordinary') AS service_type, platform_fee_rate_bp, model_share_bp,
            platform_share_of_fee_bp, agent_share_of_fee_bp, broker_share_of_fee_bp,
            remark, updated_at
     FROM platform_split_rules WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertDefaultSplitRulesRow(): Promise<void> {
  await dbPool.query(
    `INSERT IGNORE INTO platform_split_rules (
       id, service_type, platform_fee_rate_bp, model_share_bp,
       platform_share_of_fee_bp, agent_share_of_fee_bp, broker_share_of_fee_bp
     ) VALUES
       (1, 'ordinary', 1500, 8500, 3400, 3300, 3300),
       (2, 'agent', 1500, 8500, 3400, 3300, 3300)`
  );
}

export function fallbackSplitRulesRowForEstimate(): SplitRulesRow {
  return {
    id: 1,
    service_type: "ordinary",
    platform_fee_rate_bp: 1500,
    model_share_bp: 8500,
    platform_share_of_fee_bp: 3400,
    agent_share_of_fee_bp: 3300,
    broker_share_of_fee_bp: 3300,
    remark: null,
    updated_at: new Date()
  } as SplitRulesRow;
}

export async function updateSplitRulesRow(
  serviceType: SplitServiceType,
  patch: {
    platformFeeRateBp: number;
    modelShareBp: number;
    platformShareOfFeeBp: number;
    agentShareOfFeeBp: number;
    brokerShareOfFeeBp: number;
  }
): Promise<boolean> {
  const [result] = await dbPool.query<ResultSetHeader>(
    `UPDATE platform_split_rules SET
       platform_fee_rate_bp = ?,
       model_share_bp = ?,
       platform_share_of_fee_bp = ?,
       agent_share_of_fee_bp = ?,
       broker_share_of_fee_bp = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE service_type = ?`,
    [
      patch.platformFeeRateBp,
      patch.modelShareBp,
      patch.platformShareOfFeeBp,
      patch.agentShareOfFeeBp,
      patch.brokerShareOfFeeBp,
      serviceType
    ]
  );
  return result.affectedRows > 0;
}
