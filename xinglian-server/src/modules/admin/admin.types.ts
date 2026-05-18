import { z } from "zod";

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

/** 统一用户列表：query.role = 1 模特 / 2 商家 / 3 经纪人 */
export const adminUsersByRoleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.coerce
    .number()
    .refine((r): r is 1 | 2 | 3 => r === 1 || r === 2 || r === 3, {
      message: "role must be 1, 2 or 3"
    })
});

export type AdminUsersByRoleQuery = z.infer<typeof adminUsersByRoleQuerySchema>;

export const adminUserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive()
});

export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;

export const adminOrderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive()
});

export type AdminOrderIdParam = z.infer<typeof adminOrderIdParamSchema>;

/** 后台审核模特资料：通过 / 驳回（驳回须填原因，由服务端二次校验） */
export const adminModelProfileAuditBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  rejectReason: z.string().trim().max(500).optional()
});

export type AdminModelProfileAuditBody = z.infer<typeof adminModelProfileAuditBodySchema>;

/** 后台为模特设置所属代理人；传 null 表示清除 */
export const adminModelAgentBodySchema = z.object({
  agentUserId: z.union([z.coerce.number().int().positive(), z.null()])
});

export type AdminModelAgentBody = z.infer<typeof adminModelAgentBodySchema>;

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Zod 4：勿用 preprocess + .optional()，缺省 query 会误报 nonoptional */
function optionalYmd(field: "dateFrom" | "dateTo") {
  return z
    .union([z.string().regex(ymdRegex, `${field} must be YYYY-MM-DD`), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));
}

function optionalLedgerKeyword() {
  return z
    .union([z.string().max(64), z.literal("")])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const s = v.trim();
      return s.length ? s : undefined;
    });
}

/** 平台流水：全量记账列表，支持日期与分账状态筛选 */
export const adminPlatformLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: optionalYmd("dateFrom"),
  dateTo: optionalYmd("dateTo"),
  keyword: optionalLedgerKeyword(),
  settleStatus: z.enum(["all", "settled", "pending"]).default("all")
});

export type AdminPlatformLedgerQuery = z.infer<typeof adminPlatformLedgerQuerySchema>;
