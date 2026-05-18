import {
  countBoundMerchantsForBroker,
  countBoundModelsForBroker,
  findBoundMerchantsPageForBroker,
  findBoundModelsPageForBroker,
  type BrokerBoundMerchantRow,
  type BrokerBoundModelRow
} from "./broker.repository";
import type { BrokerBoundListQuery } from "./broker.types";

function profileAuditStatusText(code: number): string {
  switch (Number(code)) {
    case 0:
      return "待提交资料";
    case 1:
      return "资料审核中";
    case 2:
      return "资料已通过";
    case 3:
      return "资料未通过";
    default:
      return `审核状态${code}`;
  }
}

function verifiedStatusText(code: number): string {
  return Number(code) === 1 ? "已实名" : "未实名";
}

function accountStatusText(code: number): string {
  return Number(code) === 1 ? "正常" : "已停用";
}

function maskPhone(phone: string | null): string {
  const s = (phone ?? "").trim();
  if (!s) return "";
  if (s.length >= 11) {
    return `${s.slice(0, 3)}****${s.slice(-4)}`;
  }
  if (s.length >= 7) {
    return `${s.slice(0, 2)}****${s.slice(-2)}`;
  }
  return s;
}

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length ? s : null;
}

function bindDateLabel(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function mapMerchantRow(row: BrokerBoundMerchantRow) {
  const contractAt = toIso(row.contract_platform_merchant_signed_at);
  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "未设置昵称",
    avatarUrl: row.avatar_url,
    phoneMasked: maskPhone(row.phone),
    city: row.city || "",
    status: Number(row.status ?? 0),
    statusText: accountStatusText(row.status),
    verifiedStatus: Number(row.verified_status ?? 0),
    verifiedStatusText: verifiedStatusText(row.verified_status),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    profileAuditStatusText: profileAuditStatusText(row.profile_audit_status),
    contractSigned: contractAt != null,
    contractSignedText: contractAt != null ? "已签平台商家合同" : "未签平台商家合同",
    boundAt: bindDateLabel(toIso(row.created_at))
  };
}

function mapModelRow(row: BrokerBoundModelRow) {
  const contractAt = toIso(row.contract_broker_model_signed_at);
  const orderEnabled =
    row.model_order_enabled == null ? null : Boolean(Number(row.model_order_enabled));
  return {
    userId: row.id,
    userNo: row.user_no,
    nickname: row.nickname || "未设置昵称",
    avatarUrl: row.avatar_url,
    phoneMasked: maskPhone(row.phone),
    city: row.city || "",
    status: Number(row.status ?? 0),
    statusText: accountStatusText(row.status),
    verifiedStatus: Number(row.verified_status ?? 0),
    verifiedStatusText: verifiedStatusText(row.verified_status),
    profileAuditStatus: Number(row.profile_audit_status ?? 0),
    profileAuditStatusText: profileAuditStatusText(row.profile_audit_status),
    contractSigned: contractAt != null,
    contractSignedText: contractAt != null ? "已签经纪模特合同" : "未签经纪模特合同",
    orderEnabled,
    orderEnabledText:
      orderEnabled === null ? "接单状态未知" : orderEnabled ? "接单中" : "暂停接单",
    boundAt: bindDateLabel(toIso(row.created_at))
  };
}

export async function listMyMerchantsForBroker(
  brokerUserId: number,
  query: BrokerBoundListQuery
): Promise<{
  list: ReturnType<typeof mapMerchantRow>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = query.page;
  const pageSize = query.pageSize;
  const keyword = query.keyword?.trim() || undefined;
  const total = await countBoundMerchantsForBroker(brokerUserId, keyword);
  const offset = (page - 1) * pageSize;
  const rows = await findBoundMerchantsPageForBroker(brokerUserId, offset, pageSize, keyword);
  return {
    list: rows.map(mapMerchantRow),
    total,
    page,
    pageSize
  };
}

export async function listMyModelsForBroker(
  brokerUserId: number,
  query: BrokerBoundListQuery
): Promise<{
  list: ReturnType<typeof mapModelRow>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = query.page;
  const pageSize = query.pageSize;
  const keyword = query.keyword?.trim() || undefined;
  const total = await countBoundModelsForBroker(brokerUserId, keyword);
  const offset = (page - 1) * pageSize;
  const rows = await findBoundModelsPageForBroker(brokerUserId, offset, pageSize, keyword);
  return {
    list: rows.map(mapModelRow),
    total,
    page,
    pageSize
  };
}
