import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import {
  countCommercialShoots,
  deleteCommercialShoot,
  findCommercialShootById,
  findCommercialShootsPage,
  insertCommercialShoot,
  updateCommercialShoot,
  type CommercialShootRow
} from "./commercial-shoot-center.repository";
import {
  countCommercialShootPackagesByShootId,
  countCommercialShootPackagesByShootIds,
  deleteCommercialShootPackage,
  findCommercialShootPackageById,
  findCommercialShootPackagesByShootIdPage,
  findCommercialShootPackagesByShootIds,
  insertCommercialShootPackage,
  updateCommercialShootPackage,
  type CommercialShootPackageRow
} from "./commercial-shoot-package.repository";
import {
  type CreateCommercialShootInput,
  type CreateCommercialShootPackageInput,
  type UpdateCommercialShootInput,
  type UpdateCommercialShootPackageInput
} from "./commercial-shoot-center.types";

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function trimText(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text;
}

function parseImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 9);
  } catch {
    return [];
  }
}

function mapCommercialShootPackage(row: CommercialShootPackageRow) {
  return {
    id: Number(row.id),
    shootId: Number(row.shoot_id),
    name: String(row.name || "").trim(),
    fee: trimText(row.fee),
    listPrice: trimText(row.list_price),
    remark: trimText(row.remark),
    coverUrl: trimText(row.cover_url),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function groupPackagesByShootId(rows: CommercialShootPackageRow[]) {
  const grouped = new Map<number, ReturnType<typeof mapCommercialShootPackage>[]>();
  for (const row of rows) {
    const shootId = Number(row.shoot_id);
    const list = grouped.get(shootId) ?? [];
    list.push(mapCommercialShootPackage(row));
    grouped.set(shootId, list);
  }
  return grouped;
}

function mapCommercialShoot(
  row: CommercialShootRow,
  options?: {
    packages?: ReturnType<typeof mapCommercialShootPackage>[];
    packageCount?: number;
  }
) {
  return {
    id: Number(row.id),
    name: String(row.name || "").trim(),
    province: trimText(row.province),
    city: trimText(row.city),
    district: trimText(row.district),
    detailAddress: trimText(row.detail_address),
    contactName: trimText(row.contact_name),
    contactPhone: trimText(row.contact_phone),
    priceRange: trimText(row.price_range),
    description: trimText(row.description),
    imageUrls: parseImageUrls(row.image_urls),
    packageCount: options?.packageCount ?? 0,
    packages: options?.packages ?? [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function normalizeCreateInput(input: CreateCommercialShootInput) {
  return {
    name: input.name.trim(),
    province: trimText(input.province),
    city: trimText(input.city),
    district: trimText(input.district),
    detailAddress: trimText(input.detailAddress),
    contactName: trimText(input.contactName),
    contactPhone: trimText(input.contactPhone),
    priceRange: trimText(input.priceRange),
    description: trimText(input.description),
    imageUrls: JSON.stringify(input.imageUrls || [])
  };
}

function normalizeUpdateInput(input: UpdateCommercialShootInput) {
  const patch: {
    name?: string;
    province?: string;
    city?: string;
    district?: string;
    detailAddress?: string;
    contactName?: string;
    contactPhone?: string;
    priceRange?: string;
    description?: string;
    imageUrls?: string;
  } = {};

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.province !== undefined) patch.province = trimText(input.province);
  if (input.city !== undefined) patch.city = trimText(input.city);
  if (input.district !== undefined) patch.district = trimText(input.district);
  if (input.detailAddress !== undefined) patch.detailAddress = trimText(input.detailAddress);
  if (input.contactName !== undefined) patch.contactName = trimText(input.contactName);
  if (input.contactPhone !== undefined) patch.contactPhone = trimText(input.contactPhone);
  if (input.priceRange !== undefined) patch.priceRange = trimText(input.priceRange);
  if (input.description !== undefined) patch.description = trimText(input.description);
  if (input.imageUrls !== undefined) patch.imageUrls = JSON.stringify(input.imageUrls || []);
  return patch;
}

async function attachPackagesToShootRows(rows: CommercialShootRow[], includePackages: boolean) {
  const shootIds = rows.map((row) => Number(row.id));
  const [packageRows, packageCounts] = await Promise.all([
    includePackages ? findCommercialShootPackagesByShootIds(shootIds) : Promise.resolve([]),
    countCommercialShootPackagesByShootIds(shootIds)
  ]);
  const grouped = groupPackagesByShootId(packageRows);
  return rows.map((row) => {
    const shootId = Number(row.id);
    return mapCommercialShoot(row, {
      packageCount: packageCounts.get(shootId) ?? 0,
      packages: grouped.get(shootId) ?? []
    });
  });
}

export async function listCommercialShootsForAdmin(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    countCommercialShoots(),
    findCommercialShootsPage(offset, pageSize)
  ]);
  return {
    total,
    page,
    pageSize,
    list: await attachPackagesToShootRows(rows, false)
  };
}

export async function listPublishedCommercialShoots(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    countCommercialShoots(),
    findCommercialShootsPage(offset, pageSize)
  ]);
  return {
    total,
    page,
    pageSize,
    list: await attachPackagesToShootRows(rows, true)
  };
}

export async function createCommercialShoot(input: CreateCommercialShootInput) {
  const normalized = normalizeCreateInput(input);
  const id = await insertCommercialShoot(normalized);
  const row = await findCommercialShootById(id);
  if (!row) {
    throw new AppError("创建商拍失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return mapCommercialShoot(row, { packageCount: 0, packages: [] });
}

export async function updateCommercialShootById(id: number, input: UpdateCommercialShootInput) {
  const existing = await findCommercialShootById(id);
  if (!existing) {
    throw new AppError("商拍不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const ok = await updateCommercialShoot(id, normalizeUpdateInput(input));
  if (!ok) {
    throw new AppError("商拍更新失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const row = await findCommercialShootById(id);
  if (!row) {
    throw new AppError("商拍不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const packageCount = await countCommercialShootPackagesByShootId(id);
  return mapCommercialShoot(row, { packageCount, packages: [] });
}

export async function removeCommercialShoot(id: number): Promise<void> {
  const existing = await findCommercialShootById(id);
  if (!existing) {
    throw new AppError("商拍不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const ok = await deleteCommercialShoot(id);
  if (!ok) {
    throw new AppError("商拍删除失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
}

function normalizePackageCreateInput(input: CreateCommercialShootPackageInput) {
  const remark = trimText(input.remark);
  return {
    name: input.name.trim(),
    fee: trimText(input.fee),
    listPrice: trimText(input.listPrice),
    remark: remark || null,
    coverUrl: trimText(input.coverUrl),
    sortOrder: Number(input.sortOrder ?? 0)
  };
}

function normalizePackageUpdateInput(input: UpdateCommercialShootPackageInput) {
  const patch: {
    name?: string;
    fee?: string;
    listPrice?: string;
    remark?: string | null;
    coverUrl?: string;
    sortOrder?: number;
  } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.fee !== undefined) patch.fee = trimText(input.fee);
  if (input.listPrice !== undefined) patch.listPrice = trimText(input.listPrice);
  if (input.remark !== undefined) {
    const remark = trimText(input.remark);
    patch.remark = remark || null;
  }
  if (input.coverUrl !== undefined) patch.coverUrl = trimText(input.coverUrl);
  if (input.sortOrder !== undefined) patch.sortOrder = Number(input.sortOrder ?? 0);
  return patch;
}

async function assertCommercialShootExists(shootId: number): Promise<CommercialShootRow> {
  const row = await findCommercialShootById(shootId);
  if (!row) {
    throw new AppError("商拍不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return row;
}

export async function listCommercialShootPackagesForAdmin(
  shootId: number,
  page: number,
  pageSize: number
) {
  await assertCommercialShootExists(shootId);
  const offset = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    countCommercialShootPackagesByShootId(shootId),
    findCommercialShootPackagesByShootIdPage(shootId, offset, pageSize)
  ]);
  return {
    total,
    page,
    pageSize,
    list: rows.map(mapCommercialShootPackage)
  };
}

export async function createCommercialShootPackage(
  shootId: number,
  input: CreateCommercialShootPackageInput
) {
  await assertCommercialShootExists(shootId);
  const normalized = normalizePackageCreateInput(input);
  const id = await insertCommercialShootPackage({
    shootId,
    ...normalized
  });
  const row = await findCommercialShootPackageById(id);
  if (!row) {
    throw new AppError("创建商拍套餐失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  return mapCommercialShootPackage(row);
}

export async function updateCommercialShootPackageById(
  shootId: number,
  packageId: number,
  input: UpdateCommercialShootPackageInput
) {
  await assertCommercialShootExists(shootId);
  const existing = await findCommercialShootPackageById(packageId);
  if (!existing || Number(existing.shoot_id) !== shootId) {
    throw new AppError("商拍套餐不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const ok = await updateCommercialShootPackage(packageId, normalizePackageUpdateInput(input));
  if (!ok) {
    throw new AppError("商拍套餐更新失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const row = await findCommercialShootPackageById(packageId);
  if (!row) {
    throw new AppError("商拍套餐不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return mapCommercialShootPackage(row);
}

export async function removeCommercialShootPackage(
  shootId: number,
  packageId: number
): Promise<void> {
  await assertCommercialShootExists(shootId);
  const existing = await findCommercialShootPackageById(packageId);
  if (!existing || Number(existing.shoot_id) !== shootId) {
    throw new AppError("商拍套餐不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const ok = await deleteCommercialShootPackage(packageId);
  if (!ok) {
    throw new AppError("商拍套餐删除失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
}
