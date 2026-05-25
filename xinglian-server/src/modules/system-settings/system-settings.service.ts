import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import {
  findSystemSetting,
  MERCHANT_ORDER_ENABLED_KEY,
  SystemSettingRow,
  upsertSystemSetting
} from "./system-settings.repository";

const DEFAULT_MERCHANT_ORDER_ENABLED = true;

function boolToSettingValue(enabled: boolean): string {
  return enabled ? "1" : "0";
}

function settingValueToBool(value: unknown): boolean {
  if (value == null) return DEFAULT_MERCHANT_ORDER_ENABLED;
  return String(value) !== "0";
}

function rowUpdatedAt(row: SystemSettingRow | null): string {
  if (!row?.updated_at) return "";
  return row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
}

export async function getSystemSettings(): Promise<{
  merchantOrderEnabled: boolean;
  updatedAt: string;
}> {
  const row = await findSystemSetting(MERCHANT_ORDER_ENABLED_KEY);
  return {
    merchantOrderEnabled: settingValueToBool(row?.setting_value),
    updatedAt: rowUpdatedAt(row)
  };
}

export async function updateSystemSettings(body: {
  merchantOrderEnabled: boolean;
}): Promise<{
  merchantOrderEnabled: boolean;
  updatedAt: string;
}> {
  const ok = await upsertSystemSetting(
    MERCHANT_ORDER_ENABLED_KEY,
    boolToSettingValue(body.merchantOrderEnabled)
  );
  if (!ok) {
    throw new AppError("系统设置保存失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return getSystemSettings();
}

export async function assertMerchantOrderEnabled(): Promise<void> {
  const settings = await getSystemSettings();
  if (!settings.merchantOrderEnabled) {
    throw new AppError("目前商户不允许下单，请联系管理员", 400, ErrorCodes.VALIDATION_ERROR);
  }
}
