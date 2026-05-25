import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

import {
  saveBasicInfo,
  saveCard,
  saveCategories,
  saveOrderSettings,
  savePortfolio,
  savePricing,
  saveSchedule,
  saveStylePosition
} from "../model/model.service";
import { getModelBasicDetailForAdmin } from "./admin.service";

import type { AdminModelCreateBody } from "./admin-model.types";
import { allocateUniqueUserNo } from "./admin-agent.repository";
import {
  findAgentUserIdForModelBind,
  findUserIdByPhoneForAdmin,
  insertModelUserForAdmin
} from "./admin-model.repository";

async function assertPhoneAvailable(phone: string): Promise<void> {
  const existing = await findUserIdByPhoneForAdmin(phone);
  if (existing != null) {
    throw new AppError("该手机号已被其他账号使用", 409, ErrorCodes.CONFLICT);
  }
}

export async function createModelForAdmin(body: AdminModelCreateBody) {
  const phone = body.basicInfo.phone.trim();
  await assertPhoneAvailable(phone);

  let agentUserId: number | null = null;
  if (body.agentUserId != null) {
    const aid = await findAgentUserIdForModelBind(body.agentUserId);
    if (aid == null) {
      throw new AppError("所属代理人不存在", 404, ErrorCodes.NOT_FOUND);
    }
    agentUserId = aid;
  }

  const userNo = await allocateUniqueUserNo();
  const stageName = body.basicInfo.name.trim();
  const userId = await insertModelUserForAdmin({
    userNo,
    phone,
    nickname: stageName,
    avatarUrl: body.avatarUrl ? String(body.avatarUrl).trim() : null,
    status: body.status,
    agentUserId
  });

  await saveBasicInfo(userId, body.basicInfo as Record<string, unknown>);
  await saveCategories(userId, { categoryIds: body.categoryIds });
  await saveCard(userId, body.card as Record<string, unknown>);
  if (body.portfolio) {
    await savePortfolio(userId, body.portfolio as Record<string, unknown>);
  }
  if (body.stylePosition) {
    await saveStylePosition(userId, body.stylePosition as Record<string, unknown>);
  }
  await savePricing(userId, body.pricing as Record<string, unknown>);
  if (body.schedule) {
    await saveSchedule(userId, body.schedule as Record<string, unknown>);
  }
  await saveOrderSettings(userId, body.orderSettings);

  const basicInfo = await getModelBasicDetailForAdmin(userId);
  return basicInfo;
}
