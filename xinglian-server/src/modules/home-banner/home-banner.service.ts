import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import {
  countHomeBanners,
  deleteHomeBanner,
  findEnabledHomeBanners,
  findHomeBannerById,
  findHomeBannersPage,
  insertHomeBanner,
  updateHomeBanner,
  type HomeBannerRow
} from "./home-banner.repository";
import type { CreateHomeBannerInput, UpdateHomeBannerInput } from "./home-banner.types";

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function trimText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function mapHomeBanner(row: HomeBannerRow) {
  return {
    id: Number(row.id),
    type: row.type,
    sortOrder: Number(row.sort_order ?? 0),
    imageUrl: trimText(row.image_url) || null,
    coverUrl: trimText(row.cover_url) || null,
    videoUrl: trimText(row.video_url) || null,
    enabled: Number(row.enabled) === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function requireHomeBanner(id: number) {
  const row = await findHomeBannerById(id);
  if (!row) {
    throw new AppError("Banner 不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return row;
}

function buildInsertPayload(input: CreateHomeBannerInput) {
  if (input.type === "image") {
    return {
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
      coverUrl: input.coverUrl,
      imageUrl: input.imageUrl,
      videoUrl: null,
      enabled: input.enabled ?? true
    };
  }
  return {
    type: input.type,
    sortOrder: input.sortOrder ?? 0,
    coverUrl: input.coverUrl,
    imageUrl: null,
    videoUrl: input.videoUrl,
    enabled: input.enabled ?? true
  };
}

function buildUpdatePayload(input: UpdateHomeBannerInput) {
  if (input.type === "image") {
    return {
      type: input.type,
      sortOrder: input.sortOrder,
      coverUrl: input.coverUrl,
      imageUrl: input.imageUrl,
      videoUrl: null,
      enabled: input.enabled
    };
  }
  return {
    type: input.type,
    sortOrder: input.sortOrder,
    coverUrl: input.coverUrl,
    imageUrl: null,
    videoUrl: input.videoUrl,
    enabled: input.enabled
  };
}

export async function listHomeBannersForAdmin(page: number, pageSize: number) {
  const total = await countHomeBanners();
  const offset = (page - 1) * pageSize;
  const rows = await findHomeBannersPage(offset, pageSize);
  return {
    list: rows.map(mapHomeBanner),
    total,
    page,
    pageSize
  };
}

export async function listPublishedHomeBanners() {
  const rows = await findEnabledHomeBanners();
  return {
    list: rows.map(mapHomeBanner)
  };
}

export async function getPublishedHomeBannerById(id: number) {
  const row = await findHomeBannerById(id);
  if (!row || Number(row.enabled) !== 1) {
    throw new AppError("Banner 不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return mapHomeBanner(row);
}

export async function createHomeBanner(input: CreateHomeBannerInput) {
  const id = await insertHomeBanner(buildInsertPayload(input));
  const row = await findHomeBannerById(id);
  if (!row) {
    throw new AppError("Banner 创建失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return mapHomeBanner(row);
}

export async function updateHomeBannerById(id: number, input: UpdateHomeBannerInput) {
  await requireHomeBanner(id);
  const patch = buildUpdatePayload(input);
  const updated = await updateHomeBanner(id, patch);
  if (!updated) {
    throw new AppError("Banner 更新失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const row = await findHomeBannerById(id);
  if (!row) {
    throw new AppError("Banner 不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return mapHomeBanner(row);
}

export async function removeHomeBanner(id: number) {
  await requireHomeBanner(id);
  const deleted = await deleteHomeBanner(id);
  if (!deleted) {
    throw new AppError("Banner 删除失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
}
