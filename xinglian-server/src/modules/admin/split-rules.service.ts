import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

import {
  findSplitRulesByServiceType,
  insertDefaultSplitRulesRow,
  normalizeSplitServiceType,
  SplitRulesRow,
  SplitServiceType,
  updateSplitRulesRow
} from "./split-rules.repository";
import type { SplitRulesUpdateDto } from "./split-rules.types";

function rowToApi(row: SplitRulesRow): Record<string, unknown> {
  return {
    id: row.id,
    serviceType: normalizeSplitServiceType(row.service_type),
    platformFeeRateBp: Number(row.platform_fee_rate_bp),
    modelShareBp: Number(row.model_share_bp),
    platformShareOfFeeBp: Number(row.platform_share_of_fee_bp),
    agentShareOfFeeBp: Number(row.agent_share_of_fee_bp),
    brokerShareOfFeeBp: Number(row.broker_share_of_fee_bp),
    remark: row.remark,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  };
}

export async function ensureSplitRulesSeed(): Promise<void> {
  await insertDefaultSplitRulesRow();
}

export async function getSplitRulesForAdmin(serviceTypeRaw?: unknown): Promise<Record<string, unknown>> {
  const serviceType = normalizeSplitServiceType(serviceTypeRaw);
  await ensureSplitRulesSeed();
  const row = await findSplitRulesByServiceType(serviceType);
  if (!row) {
    throw new AppError("split rules not found", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return rowToApi(row);
}

export async function updateSplitRulesForAdmin(body: SplitRulesUpdateDto): Promise<Record<string, unknown>> {
  const serviceType: SplitServiceType = normalizeSplitServiceType(body.serviceType);
  const patch = {
    platformFeeRateBp: body.platformFeeRateBp,
    modelShareBp: body.modelShareBp,
    platformShareOfFeeBp: body.platformShareOfFeeBp,
    agentShareOfFeeBp: body.agentShareOfFeeBp,
    brokerShareOfFeeBp: body.brokerShareOfFeeBp
  };
  let ok = await updateSplitRulesRow(serviceType, patch);
  if (!ok) {
    await ensureSplitRulesSeed();
    ok = await updateSplitRulesRow(serviceType, patch);
  }
  if (!ok) {
    throw new AppError("failed to update split rules", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return getSplitRulesForAdmin(serviceType);
}
