import { z } from "zod";

export const basicInfoSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(["女", "男"]),
  birthDate: z.string().min(1),
  city: z.string().min(1),
  intro: z.string().min(1).max(200),
  phone: z.string().regex(/^1\d{10}$/)
});

const cardMeasurementsSchema = z.object({
  height: z.coerce.number().int().positive(),
  weight: z.coerce.number().int().positive(),
  bust: z.coerce.number().int().positive(),
  waist: z.coerce.number().int().positive(),
  hip: z.coerce.number().int().positive(),
  shoulder: z.coerce.number().int().positive(),
  armSpan: z.coerce.number().int().positive(),
  legLength: z.coerce.number().int().positive(),
  shoeSize: z.coerce.number().int().positive()
});

export const categoriesSchema = z.object({
  categoryIds: z.array(z.coerce.number().int().positive()).default([])
});

export const cardSchema = z.object({
  photoAngles: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        required: z.boolean().optional(),
        url: z.string().optional(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional()
      })
    )
    .default([])
    .refine(
      (items) => items.filter((item) => String(item.url || "").trim().length > 0).length >= 1,
      { message: "at least one photo is required" }
    ),
  measurements: cardMeasurementsSchema,
  hairColor: z.string().min(1),
  skinColor: z.string().min(1)
});

const portfolioFolderInput = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(50),
  /** 该文件夹封面：本文件夹内照片 id */
  coverPhotoId: z.string().max(80).optional()
});

const portfolioPhotoInput = z.object({
  id: z.string().max(80).optional(),
  folderId: z.string().max(80).optional(),
  url: z.string().min(1).max(2048),
  /** legacy：旧版全局封面标记，服务端会迁移到 folders[].coverPhotoId */
  isCover: z.boolean().optional(),
  /** legacy：多分类标签 */
  categories: z.array(z.string()).optional()
});

/** 保存作品集：优先 `folders`；兼容 legacy `categories` */
export const portfolioSchema = z.object({
  folders: z.array(portfolioFolderInput).max(10).optional(),
  categories: z
    .array(
      z.union([
        z.string().min(1).max(50),
        z.object({ id: z.string().max(80).optional(), name: z.string().min(1).max(50) })
      ])
    )
    .max(10)
    .optional(),
  photos: z.array(portfolioPhotoInput).max(100).default([])
});

const stylePositionPhotoInput = z.object({
  id: z.string().max(80).optional(),
  url: z.string().min(1).max(2048)
});

export const stylePositionSchema = z.object({
  photos: z.array(stylePositionPhotoInput).max(100).default([])
});

export const pricingSchema = z.object({
  hourly: z.coerce.number().int().positive().optional().nullable(),
  halfDay: z.coerce.number().int().positive().optional().nullable(),
  fullDay: z.coerce.number().int().positive().optional().nullable()
});

export const scheduleSchema = z.object({
  scheduleMap: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.enum(["available", "full", "rest"])).default({})
});

export const orderSettingsSchema = z.object({
  settings: z.object({
    orderEnabled: z.boolean().default(false),
    onlyLocal: z.boolean().default(false),
    onlyFemale: z.boolean().default(false)
  })
});

/** 查询公开模特详情：对外 userNo（12 位）或内部 userId（与列表 userId 一致）二选一 */
export const modelDetailQuerySchema = z
  .object({
    userNo: z.string().trim().min(1).optional(),
    userId: z.coerce.number().int().positive().optional()
  })
  .refine((q) => Boolean(q.userNo) || q.userId != null, {
    message: "userNo or userId is required",
    path: ["userNo"]
  });
