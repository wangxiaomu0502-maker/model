import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import {
  findSystemSetting,
  findSystemSettings,
  HOME_STAT_BROKER_OFFSET_KEY,
  HOME_STAT_MERCHANT_OFFSET_KEY,
  HOME_STAT_MODEL_OFFSET_KEY,
  MERCHANT_ORDER_ENABLED_KEY,
  SystemSettingRow,
  upsertSystemSetting
} from "./system-settings.repository";

const DEFAULT_MERCHANT_ORDER_ENABLED = true;
const DEFAULT_HOME_STAT_OFFSET = 0;

export type HomeStatOffsets = {
  model: number;
  merchant: number;
  broker: number;
};

function boolToSettingValue(enabled: boolean): string {
  return enabled ? "1" : "0";
}

function settingValueToBool(value: unknown): boolean {
  if (value == null) return DEFAULT_MERCHANT_ORDER_ENABLED;
  return String(value) !== "0";
}

function settingValueToInt(value: unknown): number {
  if (value == null || value === "") return DEFAULT_HOME_STAT_OFFSET;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : DEFAULT_HOME_STAT_OFFSET;
}

function rowUpdatedAt(row: SystemSettingRow | null | undefined): string {
  if (!row?.updated_at) return "";
  return row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
}

function latestUpdatedAt(rows: Array<SystemSettingRow | null | undefined>): string {
  let latest = 0;
  let latestText = "";
  for (const row of rows) {
    if (!row?.updated_at) continue;
    const text = rowUpdatedAt(row);
    const time = new Date(text).getTime();
    if (Number.isFinite(time) && time >= latest) {
      latest = time;
      latestText = text;
    }
  }
  return latestText;
}

function offsetSettingsToResponse(rows: Map<string, SystemSettingRow>): HomeStatOffsets {
  return {
    model: settingValueToInt(rows.get(HOME_STAT_MODEL_OFFSET_KEY)?.setting_value),
    merchant: settingValueToInt(rows.get(HOME_STAT_MERCHANT_OFFSET_KEY)?.setting_value),
    broker: settingValueToInt(rows.get(HOME_STAT_BROKER_OFFSET_KEY)?.setting_value)
  };
}

export async function getSystemSettings(): Promise<{
  merchantOrderEnabled: boolean;
  homeStatModelOffset: number;
  homeStatMerchantOffset: number;
  homeStatBrokerOffset: number;
  updatedAt: string;
}> {
  const rows = await findSystemSettings([
    MERCHANT_ORDER_ENABLED_KEY,
    HOME_STAT_MODEL_OFFSET_KEY,
    HOME_STAT_MERCHANT_OFFSET_KEY,
    HOME_STAT_BROKER_OFFSET_KEY
  ]);
  const merchantOrderRow = rows.get(MERCHANT_ORDER_ENABLED_KEY);
  const offsets = offsetSettingsToResponse(rows);
  return {
    merchantOrderEnabled: settingValueToBool(merchantOrderRow?.setting_value),
    homeStatModelOffset: offsets.model,
    homeStatMerchantOffset: offsets.merchant,
    homeStatBrokerOffset: offsets.broker,
    updatedAt: latestUpdatedAt(Array.from(rows.values()))
  };
}

export async function updateSystemSettings(body: {
  merchantOrderEnabled: boolean;
  homeStatModelOffset: number;
  homeStatMerchantOffset: number;
  homeStatBrokerOffset: number;
}): Promise<{
  merchantOrderEnabled: boolean;
  homeStatModelOffset: number;
  homeStatMerchantOffset: number;
  homeStatBrokerOffset: number;
  updatedAt: string;
}> {
  const okList = await Promise.all([
    upsertSystemSetting(MERCHANT_ORDER_ENABLED_KEY, boolToSettingValue(body.merchantOrderEnabled)),
    upsertSystemSetting(HOME_STAT_MODEL_OFFSET_KEY, String(Math.trunc(body.homeStatModelOffset))),
    upsertSystemSetting(HOME_STAT_MERCHANT_OFFSET_KEY, String(Math.trunc(body.homeStatMerchantOffset))),
    upsertSystemSetting(HOME_STAT_BROKER_OFFSET_KEY, String(Math.trunc(body.homeStatBrokerOffset)))
  ]);
  if (okList.some((ok) => !ok)) {
    throw new AppError("系统设置保存失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return getSystemSettings();
}

export async function getHomeStatOffsets(): Promise<HomeStatOffsets> {
  const rows = await findSystemSettings([
    HOME_STAT_MODEL_OFFSET_KEY,
    HOME_STAT_MERCHANT_OFFSET_KEY,
    HOME_STAT_BROKER_OFFSET_KEY
  ]);
  return offsetSettingsToResponse(rows);
}

export async function assertMerchantOrderEnabled(): Promise<void> {
  const row = await findSystemSetting(MERCHANT_ORDER_ENABLED_KEY);
  if (!settingValueToBool(row?.setting_value)) {
    throw new AppError("目前商户不允许下单，请联系管理员", 400, ErrorCodes.VALIDATION_ERROR);
  }
}
