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

import type { AdminModelCreateBody, AdminModelUpdateBody } from "./admin-model.types";
import { allocateUniqueUserNo } from "./admin-agent.repository";
import {
  findAdminCreatedModelUserIdForAdmin,
  findAgentUserIdForModelBind,
  findUserIdByPhoneForAdmin,
  insertModelUserForAdmin,
  updateModelUserForAdmin
} from "./admin-model.repository";

async function assertPhoneAvailable(phone: string): Promise<void> {
  const existing = await findUserIdByPhoneForAdmin(phone);
  if (existing != null) {
    throw new AppError("该手机号已被其他账号使用", 409, ErrorCodes.CONFLICT);
  }
}

async function resolveAgentUserIdForAdmin(agentUserId: number | null | undefined): Promise<number | null> {
  if (agentUserId == null) return null;
  const aid = await findAgentUserIdForModelBind(agentUserId);
  if (aid == null) {
    throw new AppError("所属代理人不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return aid;
}

async function saveModelPayloadForAdmin(
  userId: number,
  body: AdminModelCreateBody | AdminModelUpdateBody
): Promise<void> {
  await saveBasicInfo(userId, body.basicInfo as Record<string, unknown>);
  await saveCategories(userId, { categoryIds: body.categoryIds ?? [] });
  if (body.card) {
    await saveCard(userId, body.card as Record<string, unknown>);
  }
  if (body.portfolio) {
    await savePortfolio(userId, body.portfolio as Record<string, unknown>);
  }
  if (body.stylePosition) {
    await saveStylePosition(userId, body.stylePosition as Record<string, unknown>);
  }
  if (body.pricing) {
    await savePricing(userId, body.pricing as Record<string, unknown>);
  }
  if (body.schedule) {
    await saveSchedule(userId, body.schedule as Record<string, unknown>);
  }
  await saveOrderSettings(
    userId,
    body.orderSettings ?? {
      settings: { orderEnabled: false, onlyLocal: false, onlyFemale: false }
    }
  );
}

export async function createModelForAdmin(body: AdminModelCreateBody) {
  const phone = body.basicInfo.phone.trim();
  await assertPhoneAvailable(phone);

  const agentUserId = await resolveAgentUserIdForAdmin(body.agentUserId);

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

  await saveModelPayloadForAdmin(userId, body);

  const basicInfo = await getModelBasicDetailForAdmin(userId);
  return basicInfo;
}

export async function updateModelForAdmin(userId: number, body: AdminModelUpdateBody) {
  const modelId = await findAdminCreatedModelUserIdForAdmin(userId);
  if (modelId == null) {
    throw new AppError("仅后管创建的模特允许编辑", 404, ErrorCodes.NOT_FOUND);
  }

  const phone = body.basicInfo.phone.trim();
  const existing = await findUserIdByPhoneForAdmin(phone, modelId);
  if (existing != null) {
    throw new AppError("该手机号已被其他账号使用", 409, ErrorCodes.CONFLICT);
  }

  const agentUserId = await resolveAgentUserIdForAdmin(body.agentUserId);
  const stageName = body.basicInfo.name.trim();
  const ok = await updateModelUserForAdmin({
    userId: modelId,
    phone,
    nickname: stageName,
    avatarUrl: body.avatarUrl ? String(body.avatarUrl).trim() : null,
    status: body.status,
    agentUserId
  });
  if (!ok) {
    throw new AppError("model user not found", 404, ErrorCodes.NOT_FOUND);
  }

  await saveModelPayloadForAdmin(modelId, body);
  return getModelBasicDetailForAdmin(modelId);
}
