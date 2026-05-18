import { z } from "zod";

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const s = v.trim();
      return s.length ? s : null;
    });

const optionalMobile = z
  .union([z.string().trim(), z.literal(""), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const s = v.trim();
    if (!s) return null;
    if (!/^1\d{10}$/.test(s)) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "请输入正确的11位手机号",
          path: []
        }
      ]);
    }
    return s;
  });

const requiredMobile = z
  .string()
  .trim()
  .regex(/^1\d{10}$/, "请输入正确的11位联系人电话");

const cityText = z
  .string()
  .trim()
  .min(1, "请选择所在城市")
  .max(80)
  .refine((s) => s.includes(" "), { message: "请选择完整的省、市" });

const licenseUrl = z.string().trim().min(1, "请上传营业执照").max(2048);

const statusField = z.coerce
  .number()
  .int()
  .refine((n) => n === 1 || n === 2, { message: "status 须为 1（正常）或 2（禁用）" });

export const adminAgentCreateBodySchema = z.object({
  companyName: z.string().trim().min(1, "请填写公司名称").max(100),
  contactName: z.string().trim().min(1, "请填写联系人").max(50),
  contactPhone: requiredMobile,
  emergencyContactName: optionalText(50),
  emergencyContactPhone: optionalMobile,
  city: cityText,
  businessLicenseUrl: licenseUrl,
  status: statusField.default(2)
});

export type AdminAgentCreateBody = z.infer<typeof adminAgentCreateBodySchema>;

export const adminAgentUpdateBodySchema = z.object({
  companyName: z.string().trim().min(1).max(100).optional(),
  contactName: z.string().trim().min(1).max(50).optional(),
  contactPhone: requiredMobile.optional(),
  emergencyContactName: optionalText(50),
  emergencyContactPhone: optionalMobile,
  city: cityText.optional(),
  businessLicenseUrl: licenseUrl.optional(),
  status: statusField.optional()
});

export type AdminAgentUpdateBody = z.infer<typeof adminAgentUpdateBodySchema>;
