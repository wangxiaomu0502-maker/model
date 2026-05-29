import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { findUserProfileById } from "../user/user.repository";

import {
  deleteModelHonorForUser,
  findModelHonorByIdForUser,
  getNextHonorSortOrder,
  insertModelHonor,
  listModelHonorsByUserId,
  rowToHonorDto,
  updateModelHonorForUser
} from "./model-honor.repository";
import type { ModelHonorCreateBody, ModelHonorDto, ModelHonorUpdateBody } from "./model-honor.types";

const MAX_HONORS_PER_MODEL = 50;

async function assertModelUser(userId: number): Promise<void> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(user.role) !== 1) {
    throw new AppError("仅模特可维护个人荣誉", 403, ErrorCodes.FORBIDDEN);
  }
}

function normalizeImageUrl(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export async function listHonorsForModelUser(userId: number): Promise<{ list: ModelHonorDto[] }> {
  await assertModelUser(userId);
  const rows = await listModelHonorsByUserId(userId);
  return { list: rows.map(rowToHonorDto) };
}

export async function listHonorsForPublicDisplay(userId: number): Promise<ModelHonorDto[]> {
  const rows = await listModelHonorsByUserId(userId);
  return rows.map(rowToHonorDto);
}

export async function createHonorForModelUser(
  userId: number,
  body: ModelHonorCreateBody
): Promise<ModelHonorDto> {
  await assertModelUser(userId);
  const existing = await listModelHonorsByUserId(userId);
  if (existing.length >= MAX_HONORS_PER_MODEL) {
    throw new AppError(`个人荣誉最多 ${MAX_HONORS_PER_MODEL} 条`, 400, ErrorCodes.VALIDATION_ERROR);
  }
  const sortOrder =
    body.sortOrder !== undefined ? Number(body.sortOrder) : await getNextHonorSortOrder(userId);
  const id = await insertModelHonor({
    userId,
    title: body.title.trim(),
    imageUrl: normalizeImageUrl(body.imageUrl),
    sortOrder
  });
  const row = await findModelHonorByIdForUser(id, userId);
  if (!row) {
    throw new AppError("failed to create honor", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return rowToHonorDto(row);
}

export async function updateHonorForModelUser(
  userId: number,
  honorId: number,
  body: ModelHonorUpdateBody
): Promise<ModelHonorDto> {
  await assertModelUser(userId);
  const existing = await findModelHonorByIdForUser(honorId, userId);
  if (!existing) {
    throw new AppError("荣誉不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const patch: { title?: string; imageUrl?: string | null; sortOrder?: number } = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.imageUrl !== undefined) patch.imageUrl = normalizeImageUrl(body.imageUrl);
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
  const ok = await updateModelHonorForUser(honorId, userId, patch);
  if (!ok) {
    throw new AppError("failed to update honor", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const row = await findModelHonorByIdForUser(honorId, userId);
  if (!row) {
    throw new AppError("荣誉不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return rowToHonorDto(row);
}

export async function deleteHonorForModelUser(userId: number, honorId: number): Promise<void> {
  await assertModelUser(userId);
  const ok = await deleteModelHonorForUser(honorId, userId);
  if (!ok) {
    throw new AppError("荣誉不存在", 404, ErrorCodes.NOT_FOUND);
  }
}
