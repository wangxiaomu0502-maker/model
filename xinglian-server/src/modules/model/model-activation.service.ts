import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import { hasModelProfilesColumn } from "../../shared/model-profile-columns";
import { consumeModelRegistrationCodeForUser } from "../model-registration-code/model-registration-code.service";
import { findRegistrationCodeUsedByUserId } from "../model-registration-code/model-registration-code.repository";

import {
  ensureModelProfile,
  findModelProfile,
  updateModelActivated
} from "./model.repository";

export const MODEL_NOT_ACTIVATED_MESSAGE = "请先输入授权码激活后再上传";

export async function resolveModelIsActivated(userId: number): Promise<boolean> {
  await ensureModelProfile(userId);
  const profile = await findModelProfile(userId);
  if (!profile) return false;
  if (await hasModelProfilesColumn("is_activated")) {
    if (Number(profile.is_activated ?? 0) === 1) return true;
  }
  return findRegistrationCodeUsedByUserId(userId);
}

export async function assertModelActivatedForContent(userId: number): Promise<void> {
  if (!(await resolveModelIsActivated(userId))) {
    throw new AppError(MODEL_NOT_ACTIVATED_MESSAGE, 403, ErrorCodes.FORBIDDEN);
  }
}

export async function activateModelWithRegistrationCode(
  userId: number,
  code: string
): Promise<{ isActivated: true }> {
  if (await resolveModelIsActivated(userId)) {
    return { isActivated: true };
  }
  await consumeModelRegistrationCodeForUser(code, userId);
  const ok = await updateModelActivated(userId, true);
  if (!ok) {
    throw new AppError("激活失败，请稍后重试", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return { isActivated: true };
}
