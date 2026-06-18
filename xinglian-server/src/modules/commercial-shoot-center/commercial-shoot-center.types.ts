import { z } from "zod";

export const commercialShootListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const publicCommercialShootListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const commercialShootIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const requiredText = (max: number, message: string) => z.string().trim().min(1, message).max(max);

export const createCommercialShootSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(120),
  province: requiredText(64, "请选择省份"),
  city: requiredText(64, "请选择城市"),
  district: requiredText(64, "请选择区县"),
  detailAddress: requiredText(255, "请填写详细地址"),
  contactName: requiredText(64, "请填写联系人"),
  contactPhone: requiredText(64, "请填写联系方式"),
  priceRange: requiredText(120, "请填写价格区间"),
  description: requiredText(2000, "请填写介绍"),
  imageUrls: z
    .array(z.string().trim().url("图片链接格式不正确").max(1000))
    .min(1, "请至少上传1张图片")
    .max(9, "图片最多上传9张")
});

export const updateCommercialShootSchema = createCommercialShootSchema;

export type CreateCommercialShootInput = z.infer<typeof createCommercialShootSchema>;
export type UpdateCommercialShootInput = z.infer<typeof updateCommercialShootSchema>;

export const commercialShootPackageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const commercialShootPackageIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  packageId: z.coerce.number().int().positive()
});

export const createCommercialShootPackageSchema = z.object({
  name: z.string().trim().min(1, "请填写套餐名称").max(120),
  fee: z.string().trim().min(1, "请填写费用").max(120),
  listPrice: requiredText(120, "请填写标牌价"),
  remark: z.string().trim().max(2000).optional().default(""),
  coverUrl: z.string().trim().url("头图链接格式不正确").max(1000),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0)
});

export const updateCommercialShootPackageSchema = createCommercialShootPackageSchema;

export type CreateCommercialShootPackageInput = z.infer<typeof createCommercialShootPackageSchema>;
export type UpdateCommercialShootPackageInput = z.infer<typeof updateCommercialShootPackageSchema>;
