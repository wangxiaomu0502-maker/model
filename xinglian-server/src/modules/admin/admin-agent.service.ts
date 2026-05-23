import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";

import type { AdminAgentCreateBody, AdminAgentUpdateBody } from "./admin-agent.types";
import { findUserBalance } from "../wallet/wallet.repository";

import {
  adminCreatedOpenid,
  allocateUniqueUserNo,
  clearModelsAgentBinding,
  countAgentsForAdmin,
  countBoundModelsForAgentAdmin,
  countAgentLedgerForAdmin,
  countModelsBoundToAgent,
  findAgentByPhoneForAdmin,
  findAgentDetailForAdminByUserId,
  findAgentLedgerPageForAdmin,
  findAgentsPageForAdmin,
  findBoundModelsPageForAgentAdmin,
  insertAgentForAdmin,
  softDeleteAgentForAdmin,
  sumAgentLedgerIncomeForAdmin,
  updateAgentForAdmin
} from "./admin-agent.repository";

function ledgerBizLabel(bizType: string): string {
  switch (bizType) {
    case "order_split_agent":
    case "order_split_model_referrer":
      return "订单分账入账（代理人）";
    case "withdrawal":
      return "提现";
    case "admin_adjust":
      return "平台调整";
    default:
      return bizType || "账户变动";
  }
}

function mapAgentRow(row: {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  real_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  city: string | null;
  business_license_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  bound_model_count: number | string | null;
  contract_platform_agent_signed_at: Date | string | null;
}) {
  const companyName =
    row.company_name != null && String(row.company_name).trim()
      ? String(row.company_name).trim()
      : row.nickname != null && String(row.nickname).trim()
        ? String(row.nickname).trim()
        : "";
  const contactName =
    row.contact_name != null && String(row.contact_name).trim()
      ? String(row.contact_name).trim()
      : row.real_name != null && String(row.real_name).trim()
        ? String(row.real_name).trim()
        : null;
  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: companyName,
    companyName,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    contactName,
    contactPhone: row.phone,
    emergencyContactName:
      row.emergency_contact_name != null ? String(row.emergency_contact_name) : null,
    emergencyContactPhone:
      row.emergency_contact_phone != null ? String(row.emergency_contact_phone) : null,
    city: row.city != null ? String(row.city) : null,
    businessLicenseUrl:
      row.business_license_url != null ? String(row.business_license_url) : null,
    status: Number(row.status ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    realName: contactName,
    boundModelCount: Number(row.bound_model_count ?? 0),
    platformAgentContractSignedAt:
      row.contract_platform_agent_signed_at instanceof Date
        ? row.contract_platform_agent_signed_at.toISOString()
        : row.contract_platform_agent_signed_at
          ? String(row.contract_platform_agent_signed_at)
          : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? "")
  };
}

export async function listAgentsForAdmin(
  page: number,
  pageSize: number
): Promise<{
  list: ReturnType<typeof mapAgentRow>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const total = await countAgentsForAdmin();
  const offset = (page - 1) * pageSize;
  const rows = await findAgentsPageForAdmin(offset, pageSize);
  return {
    list: rows.map(mapAgentRow),
    total,
    page,
    pageSize
  };
}

export async function getAgentDetailForAdmin(userId: number) {
  const row = await findAgentDetailForAdminByUserId(userId);
  if (!row) {
    throw new AppError("代理人不存在", 404, ErrorCodes.NOT_FOUND);
  }
  return mapAgentRow(row);
}

async function assertPhoneAvailable(phone: string, excludeUserId?: number): Promise<void> {
  const existing = await findAgentByPhoneForAdmin(phone, excludeUserId);
  if (existing != null) {
    throw new AppError("该联系人电话已被其他账号使用", 409, ErrorCodes.CONFLICT);
  }
}

export async function createAgentForAdmin(body: AdminAgentCreateBody) {
  await assertPhoneAvailable(body.contactPhone);
  const userNo = await allocateUniqueUserNo();
  const openid = adminCreatedOpenid();
  const userId = await insertAgentForAdmin({
    userNo,
    openid,
    companyName: body.companyName,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    emergencyContactName: body.emergencyContactName ?? null,
    emergencyContactPhone: body.emergencyContactPhone ?? null,
    city: body.city,
    businessLicenseUrl: body.businessLicenseUrl,
    status: body.status
  });
  return getAgentDetailForAdmin(userId);
}

export async function updateAgentForAdminService(userId: number, body: AdminAgentUpdateBody) {
  const existing = await findAgentDetailForAdminByUserId(userId);
  if (!existing) {
    throw new AppError("代理人不存在", 404, ErrorCodes.NOT_FOUND);
  }
  if (body.contactPhone !== undefined) {
    await assertPhoneAvailable(body.contactPhone, userId);
  }

  const hasPatch =
    body.companyName !== undefined ||
    body.contactName !== undefined ||
    body.contactPhone !== undefined ||
    body.emergencyContactName !== undefined ||
    body.emergencyContactPhone !== undefined ||
    body.city !== undefined ||
    body.businessLicenseUrl !== undefined ||
    body.status !== undefined;

  if (!hasPatch) {
    throw new AppError("无有效修改项", 400, ErrorCodes.VALIDATION_ERROR);
  }

  await updateAgentForAdmin(userId, {
    nickname: body.companyName,
    companyName: body.companyName,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    emergencyContactName: body.emergencyContactName,
    emergencyContactPhone: body.emergencyContactPhone,
    city: body.city,
    businessLicenseUrl: body.businessLicenseUrl,
    status: body.status
  });

  return getAgentDetailForAdmin(userId);
}

function mapBoundModelRowForAgentAdmin(row: {
  id: number;
  user_no: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: number;
  verified_status: number;
  profile_audit_status: number;
  contract_broker_model_signed_at: Date | string | null;
  model_order_enabled: number | null;
  city: string | null;
  created_at: Date | string;
}) {
  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url,
    phone: row.phone,
    status: Number(row.status ?? 0),
    verifiedStatus: Number(row.verified_status ?? 0),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    city: row.city,
    orderEnabled: row.model_order_enabled == null ? null : Boolean(Number(row.model_order_enabled)),
    modelContractSignedAt:
      row.contract_broker_model_signed_at instanceof Date
        ? row.contract_broker_model_signed_at.toISOString()
        : row.contract_broker_model_signed_at
          ? String(row.contract_broker_model_signed_at)
          : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? "")
  };
}

export async function listBoundModelsForAgentAdmin(
  agentUserId: number,
  page: number,
  pageSize: number
): Promise<{
  list: ReturnType<typeof mapBoundModelRowForAgentAdmin>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  await getAgentDetailForAdmin(agentUserId);
  const total = await countBoundModelsForAgentAdmin(agentUserId);
  const offset = (page - 1) * pageSize;
  const rows = await findBoundModelsPageForAgentAdmin(agentUserId, offset, pageSize);
  return {
    list: rows.map(mapBoundModelRowForAgentAdmin),
    total,
    page,
    pageSize
  };
}

export async function listAgentIncomeLedgerForAdmin(
  agentUserId: number,
  page: number,
  pageSize: number
): Promise<{
  list: Array<{
    id: number;
    amountYuan: number;
    balanceAfterYuan: number | null;
    bizType: string;
    bizTypeLabel: string;
    orderId: number | null;
    orderNo: string | null;
    title: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  wallet: {
    availableYuan: number;
    frozenYuan: number;
    ledgerTableReady: boolean;
    allTimeIncomeYuan: number;
  };
}> {
  await getAgentDetailForAdmin(agentUserId);
  const total = await countAgentLedgerForAdmin(agentUserId);
  const offset = (page - 1) * pageSize;
  const rows = await findAgentLedgerPageForAdmin(agentUserId, offset, pageSize);
  const bal = await findUserBalance(agentUserId);
  const allTimeIncomeYuan = Number(
    (await sumAgentLedgerIncomeForAdmin(agentUserId)).toFixed(2)
  );
  return {
    list: rows.map((r) => {
      const ca = r.created_at;
      const createdAt =
        ca instanceof Date ? ca.toISOString() : typeof ca === "string" ? ca : "";
      const bizType = String(r.biz_type ?? "");
      return {
        id: Number(r.id),
        amountYuan: Number(Number(r.amount ?? 0).toFixed(2)),
        balanceAfterYuan:
          r.balance_after != null && r.balance_after !== ""
            ? Number(Number(r.balance_after).toFixed(2))
            : null,
        bizType,
        bizTypeLabel: ledgerBizLabel(bizType),
        orderId: r.order_id != null ? Number(r.order_id) : null,
        orderNo: r.order_no != null ? String(r.order_no) : null,
        title: r.title != null ? String(r.title) : null,
        createdAt
      };
    }),
    total,
    page,
    pageSize,
    wallet: {
      availableYuan: bal ? Number(bal.availableYuan.toFixed(2)) : 0,
      frozenYuan: bal ? Number(bal.frozenYuan.toFixed(2)) : 0,
      ledgerTableReady: bal != null,
      allTimeIncomeYuan
    }
  };
}

export async function deleteAgentForAdmin(
  userId: number,
  options?: { unbindModels?: boolean }
): Promise<void> {
  const existing = await findAgentDetailForAdminByUserId(userId);
  if (!existing) {
    throw new AppError("代理人不存在", 404, ErrorCodes.NOT_FOUND);
  }
  const bound = await countModelsBoundToAgent(userId);
  if (bound > 0 && !options?.unbindModels) {
    throw new AppError(
      `该代理人下仍有 ${bound} 名模特，请先解除绑定或勾选同时解除模特归属`,
      409,
      ErrorCodes.CONFLICT
    );
  }
  if (bound > 0) {
    await clearModelsAgentBinding(userId);
  }
  const ok = await softDeleteAgentForAdmin(userId);
  if (!ok) {
    throw new AppError("删除失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
}
