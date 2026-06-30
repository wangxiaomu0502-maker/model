import {
  getAdminToken,
  type AdminBackofficeRole,
  type AdminProfile
} from "@/composables/useAdminToken";
import { prepareAdminUploadFile } from "@/utils/upload-file";

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, "") ?? "";

/** 拼装请求 URL：未配置 VITE_API_BASE_URL 时为 `/api/...`（走 Vite proxy） */
export function adminApiUrl(pathWithQuery: string): string {
  if (!pathWithQuery.startsWith("/")) {
    throw new Error(`adminApiUrl: expect path starting with /, got ${pathWithQuery}`);
  }
  return API_ORIGIN ? `${API_ORIGIN}${pathWithQuery}` : pathWithQuery;
}

export async function loginAdmin(
  username: string,
  password: string,
  loginType: AdminBackofficeRole = "admin"
): Promise<{ token: string; admin: AdminProfile }> {
  const res = await fetch(adminApiUrl("/api/admin/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, loginType })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    token?: string;
    admin?: AdminProfile;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.token || !data.admin) {
    throw new Error(data.message || data.code || `登录失败 (${res.status})`);
  }
  const admin = data.admin;
  return {
    token: data.token,
    admin: {
      ...admin,
      role: admin.role === "cs" ? "cs" : "admin"
    }
  };
}

export type CsUserRow = {
  id: number;
  username: string;
  displayName: string | null;
  phone: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
};

type CsUserListResponse = {
  ok?: boolean;
  list?: CsUserRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

export async function fetchCsUsers(
  page: number,
  pageSize: number
): Promise<{ list: CsUserRow[]; total: number; page: number; pageSize: number }> {
  const token = getAdminToken();
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await fetch(adminApiUrl(`/api/admin/cs-users?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as CsUserListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize
  };
}

export type CsUserFormBody = {
  username: string;
  password?: string;
  displayName?: string | null;
  phone?: string;
  status?: number;
};

export async function createCsUser(body: CsUserFormBody & { password: string }): Promise<CsUserRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/cs-users"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CsUserRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data;
}

export async function updateCsUser(id: number, body: CsUserFormBody): Promise<CsUserRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/cs-users/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CsUserRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `更新失败 (${res.status})`);
  }
  return data;
}

export async function deleteCsUser(id: number): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/cs-users/${id}`), {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `删除失败 (${res.status})`);
  }
}

export type ModelRegistrationCodeRow = {
  id: number;
  code: string;
  usedByUserId: number | null;
  usedAt: string | null;
  createdAt: string;
};

type ModelRegistrationCodeListResponse = {
  ok?: boolean;
  list?: ModelRegistrationCodeRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  stats?: { total: number; unused: number; used: number };
  message?: string;
  code?: string;
};

export async function fetchModelRegistrationCodes(params: {
  page: number;
  pageSize: number;
  status?: "all" | "unused" | "used";
}): Promise<{
  list: ModelRegistrationCodeRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; unused: number; used: number };
}> {
  const token = getAdminToken();
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    status: params.status || "all"
  });
  const res = await fetch(adminApiUrl(`/api/admin/model-registration-codes?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as ModelRegistrationCodeListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : params.page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : params.pageSize,
    stats: data.stats || { total: 0, unused: 0, used: 0 }
  };
}

export async function generateModelRegistrationCodes(
  count = 1000
): Promise<{ requested: number; created: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/model-registration-codes/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ count })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    requested?: number;
    created?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `生成失败 (${res.status})`);
  }
  return {
    requested: typeof data.requested === "number" ? data.requested : count,
    created: typeof data.created === "number" ? data.created : 0
  };
}

export type CommercialShootRow = {
  id: number;
  name: string;
  province: string | null;
  city: string | null;
  district: string | null;
  detailAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  priceRange: string | null;
  description: string | null;
  imageUrls: string[];
  packageCount?: number;
  createdAt: string;
  updatedAt: string;
};

type CommercialShootListResponse = {
  ok?: boolean;
  list?: CommercialShootRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

export type CommercialShootFormBody = {
  name: string;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detailAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  priceRange?: string | null;
  description?: string | null;
  imageUrls?: string[];
};

export async function fetchCommercialShoots(params: {
  page: number;
  pageSize: number;
}): Promise<{ list: CommercialShootRow[]; total: number; page: number; pageSize: number }> {
  const token = getAdminToken();
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as CommercialShootListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : params.page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : params.pageSize
  };
}

export async function createCommercialShoot(
  body: CommercialShootFormBody
): Promise<CommercialShootRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/commercial-shoots"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CommercialShootRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data;
}

export async function updateCommercialShoot(
  id: number,
  body: CommercialShootFormBody
): Promise<CommercialShootRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CommercialShootRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `更新失败 (${res.status})`);
  }
  return data;
}

export async function deleteCommercialShoot(id: number): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${id}`), {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `删除失败 (${res.status})`);
  }
}

export type CommercialShootPackageRow = {
  id: number;
  shootId: number;
  name: string;
  fee: string;
  listPrice: string;
  remark: string;
  coverUrl: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CommercialShootPackageListResponse = {
  ok?: boolean;
  list?: CommercialShootPackageRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

export type CommercialShootPackageFormBody = {
  name: string;
  fee: string;
  listPrice: string;
  remark?: string;
  coverUrl: string;
  sortOrder?: number;
};

export async function fetchCommercialShootPackages(
  shootId: number,
  params: {
    page: number;
    pageSize: number;
  }
): Promise<{ list: CommercialShootPackageRow[]; total: number; page: number; pageSize: number }> {
  const token = getAdminToken();
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${shootId}/packages?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as CommercialShootPackageListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : params.page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : params.pageSize
  };
}

export async function createCommercialShootPackage(
  shootId: number,
  body: CommercialShootPackageFormBody
): Promise<CommercialShootPackageRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${shootId}/packages`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CommercialShootPackageRow & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data;
}

export async function updateCommercialShootPackage(
  shootId: number,
  packageId: number,
  body: CommercialShootPackageFormBody
): Promise<CommercialShootPackageRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${shootId}/packages/${packageId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as CommercialShootPackageRow & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `更新失败 (${res.status})`);
  }
  return data;
}

export async function deleteCommercialShootPackage(shootId: number, packageId: number): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/commercial-shoots/${shootId}/packages/${packageId}`), {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `删除失败 (${res.status})`);
  }
}

export type HomeBannerRow = {
  id: number;
  type: "image" | "video";
  sortOrder: number;
  imageUrl: string | null;
  coverUrl: string | null;
  videoUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type HomeBannerListResponse = {
  ok?: boolean;
  list?: HomeBannerRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

export type HomeBannerFormBody =
  | {
      type: "image";
      sortOrder: number;
      enabled: boolean;
      coverUrl: string;
      imageUrl: string;
    }
  | {
      type: "video";
      sortOrder: number;
      enabled: boolean;
      coverUrl: string;
      videoUrl: string;
    };

export async function fetchHomeBanners(params: {
  page: number;
  pageSize: number;
}): Promise<{ list: HomeBannerRow[]; total: number; page: number; pageSize: number }> {
  const token = getAdminToken();
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/home-banners?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as HomeBannerListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `加载失败 (${res.status})`);
  }
  return {
    list: data.list ?? [],
    total: Number(data.total ?? 0),
    page: Number(data.page ?? params.page),
    pageSize: Number(data.pageSize ?? params.pageSize)
  };
}

export async function createHomeBanner(body: HomeBannerFormBody): Promise<HomeBannerRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/home-banners"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as HomeBannerRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.id) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data;
}

export async function updateHomeBanner(id: number, body: HomeBannerFormBody): Promise<HomeBannerRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/home-banners/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as HomeBannerRow & { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.id) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return data;
}

export async function deleteHomeBanner(id: number): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/home-banners/${id}`), {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `删除失败 (${res.status})`);
  }
}

export async function uploadAdminHomeBannerVideo(file: File): Promise<string> {
  const token = getAdminToken();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(adminApiUrl("/api/admin/home-banners/video/upload"), {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd
  });
  const data = (await res.json()) as { ok?: boolean; url?: string; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.url) {
    throw new Error(data.message || data.code || `视频上传失败 (${res.status})`);
  }
  return data.url;
}

export type CsPendingOrderRow = {
  orderId: number;
  orderNo: string;
  bookingDate: string;
  durationKind: string;
  durationKindText: string;
  hourCount: number | null;
  payableAmount: number;
  orderStatus: number;
  orderStatusText: string;
  csStatus: number;
  csStatusText: string;
  csQueuedAt: string | null;
  csStartedAt: string | null;
  csCompletedAt: string | null;
  merchantUserNo: string;
  merchantNickname: string;
  modelUserNo: string;
  modelNickname: string;
  noteCount: number;
};

export type CsOrderNote = {
  id: number;
  orderId: number;
  adminUserId: number;
  adminUsername: string;
  adminDisplayName: string | null;
  content: string;
  createdAt: string;
};

export type CsOrderParty = {
  role: "merchant" | "model" | "broker" | "agent";
  roleLabel: string;
  userId: number | null;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName: string | null;
};

export type CsPendingOrderDetail = CsPendingOrderRow & {
  serviceAmount: number;
  platformFee: number;
  paymentStatus: number;
  paidAt: string | null;
  createdAt: string;
  handlerUsername: string | null;
  handlerDisplayName: string | null;
  notes: CsOrderNote[];
  parties?: CsOrderParty[];
  readOnly?: boolean;
  actions: {
    canStart: boolean;
    canComplete: boolean;
    canAddNote: boolean;
  };
};

type CsPendingOrderListResponse = {
  ok?: boolean;
  list?: CsPendingOrderRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

function csAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPendingOrders(
  page: number,
  pageSize: number,
  csStatus?: number
): Promise<{ list: CsPendingOrderRow[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (csStatus != null) params.set("csStatus", String(csStatus));
  const res = await fetch(adminApiUrl(`/api/admin/pending-orders?${params}`), {
    headers: csAuthHeaders()
  });
  const data = (await res.json()) as CsPendingOrderListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize
  };
}

export async function fetchPendingOrderDetail(orderId: number): Promise<CsPendingOrderDetail> {
  const res = await fetch(adminApiUrl(`/api/admin/pending-orders/${orderId}`), {
    headers: csAuthHeaders()
  });
  const data = (await res.json()) as CsPendingOrderDetail & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function startPendingOrder(orderId: number): Promise<CsPendingOrderDetail> {
  const res = await fetch(adminApiUrl(`/api/admin/pending-orders/${orderId}/start`), {
    method: "POST",
    headers: csAuthHeaders()
  });
  const data = (await res.json()) as CsPendingOrderDetail & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `操作失败 (${res.status})`);
  }
  return data;
}

export async function completePendingOrder(orderId: number): Promise<CsPendingOrderDetail> {
  const res = await fetch(adminApiUrl(`/api/admin/pending-orders/${orderId}/complete`), {
    method: "POST",
    headers: csAuthHeaders()
  });
  const data = (await res.json()) as CsPendingOrderDetail & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `操作失败 (${res.status})`);
  }
  return data;
}

export async function addPendingOrderNote(
  orderId: number,
  content: string
): Promise<CsOrderNote> {
  const res = await fetch(adminApiUrl(`/api/admin/pending-orders/${orderId}/notes`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...csAuthHeaders()
    },
    body: JSON.stringify({ content })
  });
  const data = (await res.json()) as CsOrderNote & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `添加备注失败 (${res.status})`);
  }
  return data;
}

export type AdminUserRow = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  role: number;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  /** 资料驳回时的说明；列表中为简要字段 */
  profileAuditRejectReason?: string | null;
  /** 是否已绑定真实微信 openid */
  isWechatBound?: boolean;
  orderEnabled: boolean | null;
  modelContractSignedAt: string | null;
  modelContractSignatureUrl?: string | null;
  /** 平台与模特合同 broker_model，模特列表 */
  /** platform_merchant，商家列表 */
  merchantContractSignedAt?: string | null;
  /** platform_broker，经纪人列表 */
  brokerContractSignedAt?: string | null;
  /** 经纪人列表：绑定商家数（referrer_id 指向该经纪人） */
  boundMerchantCount?: number;
  /** 经纪人列表：是否专业经纪人 */
  isProfessional?: boolean | null;
  /** 经纪人列表：经纪人证 URL */
  brokerLicenseUrl?: string | null;
  /** 模特列表：是否后管创建 */
  isAdminCreated?: boolean | null;
  /** 模特列表：平台优选/重点推荐 */
  isPlatformFeatured?: boolean | null;
  /** 模特列表：用户端是否禁用模卡/作品集/形象定位 */
  photosDisabled?: boolean | null;
  /** 模特列表：是否已激活（授权码） */
  isActivated?: boolean | null;
  /** 模特列表：管理员手动指定等级；null 表示自动计算 LV0-LV1 */
  modelLevelOverride?: AdminModelLevelOverrideValue;
  /** 模特列表：展示排序，越大越靠前 */
  sortOrder?: number | null;
  /** 模特列表：自动计算等级 */
  modelLevel?: ModelLevelInfo | null;
  /** 模特列表：模卡/作品集/风格定位待审图片数 */
  contentReviewPending?: {
    card: number;
    portfolio: number;
    stylePosition: number;
  } | null;
  createdAt: string;
  updatedAt: string;
  /** 商家：绑定经纪人展示文案 */
  referrerBrokerLabel?: string | null;
  /** 商家：绑定经纪人 users.id */
  referrerBrokerUserId?: number | null;
  /** 模特：所属代理人展示文案 */
  agentUserLabel?: string | null;
};

export type AdminUserListResponse = {
  ok: boolean;
  list: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
  code?: string;
};

/** 后台商家详情（GET /api/admin/merchants/:userId/detail） */
export type AdminMerchantBasicInfo = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  realName: string | null;
  idCardNo: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardIssueAuthority: string | null;
  idCardValidDate: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  city: string | null;
  contractPlatformMerchantSignedAt: string | null;
  contractPlatformMerchantSignatureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  referrerBroker: {
    userId: number | null;
    userNo: string | null;
    nickname: string | null;
    realName: string | null;
  } | null;
};

/** 后台经纪人详情 */
export type AdminBrokerBasicInfo = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  realName: string | null;
  idCardNo: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardIssueAuthority: string | null;
  idCardValidDate: string | null;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  profileAuditRejectReason: string | null;
  contractPlatformBrokerSignedAt: string | null;
  contractPlatformBrokerSignatureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  boundMerchantCount: number;
  referrerBroker: {
    userNo: string | null;
    nickname: string | null;
    realName: string | null;
  } | null;
  isProfessional: boolean;
  brokerLicenseUrl: string | null;
};

export type AdminBrokerBoundMerchantRow = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  city: string | null;
  merchantContractSignedAt: string | null;
  createdAt: string;
};

export type AdminBrokerBoundMerchantListResponse = {
  ok: boolean;
  list: AdminBrokerBoundMerchantRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
  code?: string;
};

export type AdminModelAgentUser = {
  userId: number;
  userNo: string;
  nickname: string | null;
  realName: string | null;
};

export type ModelLevelInfo = {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  code: "LV0" | "LV1" | "LV2" | "LV3" | "LV4" | "LV5";
  name: string;
  requirement: string;
  temperament: string;
  source?: "auto" | "admin";
};

export type AdminModelBasicInfo = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  status: number;
  agentUserId?: number | null;
  agentUser?: AdminModelAgentUser | null;
  /** users.profile_audit_status */
  profileAuditStatus?: number;
  profileAuditRejectReason?: string | null;
  contractSignedAt?: string | null;
  contractSignatureUrl?: string | null;
  phone: string | null;
  realName: string | null;
  idCardNo: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardIssueAuthority: string | null;
  idCardValidDate: string | null;
  name: string;
  gender: "女" | "男";
  birthDate: string | null;
  city: string | null;
  intro: string | null;
  price: {
    hourly: number | null;
    halfDay: number | null;
    fullDay: number | null;
  };
  categories: Array<{
    id: number;
    name: string;
    type: "main" | "style" | "scene";
  }>;
  card: {
    photoAngles: Array<{
      key: string;
      label?: string;
      url?: string;
      width?: number;
      height?: number;
      reviewStatus?: number;
      rejectReason?: string;
    }>;
    measurements: Record<string, unknown>;
    hairColor: string;
    skinColor: string;
  };
  /** 旧后端可能暂无该字段 */
  portfolio?: {
    folders: Array<{ id: string; name: string; coverPhotoId?: string }>;
    photos: Array<{ id: string; folderId: string; url: string; reviewStatus?: number; rejectReason?: string }>;
  };
  /** 风格定位图片 */
  stylePosition?: {
    photos: Array<{ id: string; url: string; reviewStatus?: number; rejectReason?: string }>;
  };
  /** 个人荣誉 */
  honors?: Array<{
    id: number;
    title: string;
    imageUrl: string | null;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
  }>;
  schedule: {
    scheduleMap: Record<string, "available" | "full" | "rest">;
  };
  orderSettings: {
    orderEnabled: boolean;
    onlyLocal: boolean;
    onlyFemale: boolean;
  };
  isAdminCreated?: boolean;
  isActivated?: boolean;
  isPlatformFeatured?: boolean;
  photosDisabled?: boolean;
  modelLevelOverride?: AdminModelLevelOverrideValue;
  sortOrder?: number;
  modelLevel?: ModelLevelInfo;
  contentReview?: ModelContentReviewState;
};

export type AdminModelLevelOverride = 2 | 3 | 4 | 5;

export type AdminModelLevelOverrideValue = AdminModelLevelOverride | null;

function parseAdminModelLevelOverride(value: unknown): AdminModelLevelOverrideValue {
  const n = Number(value);
  if (n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export type AdminModelCategoryTreeNode = {
  id: number;
  name: string;
  children: AdminModelCategoryTreeNode[];
};

export type AdminModelCategoryTree = {
  mainTypeGroups: AdminModelCategoryTreeNode[];
  styleGroups: AdminModelCategoryTreeNode[];
  sceneGroups: AdminModelCategoryTreeNode[];
};

export type AdminModelCreateBody = {
  avatarUrl?: string | null;
  agentUserId?: number | null;
  status: number;
  basicInfo: {
    name: string;
    phone: string;
    gender?: "女" | "男";
    birthDate?: string;
    city?: string;
    intro?: string;
  };
  categoryIds?: number[];
  card?: {
    photoAngles: Array<{
      key: string;
      label?: string;
      url?: string;
      width?: number;
      height?: number;
    }>;
    measurements?: Record<string, number | string>;
    hairColor?: string;
    skinColor?: string;
  };
  portfolio?: {
    folders: Array<{ id: string; name: string; coverPhotoId?: string }>;
    photos: Array<{ id: string; folderId: string; url: string }>;
  };
  stylePosition?: {
    photos: Array<{ id: string; url: string }>;
  };
  pricing?: {
    hourly?: number | null;
    halfDay?: number | null;
    fullDay?: number | null;
  };
  schedule?: {
    scheduleMap: Record<string, "available" | "full" | "rest">;
  };
  orderSettings?: {
    settings: {
      orderEnabled: boolean;
      onlyLocal: boolean;
      onlyFemale: boolean;
    };
  };
};

export type AdminListKind = "models" | "merchants" | "brokers";

export type AdminDashboardDailyOrderPoint = {
  date: string;
  count: number;
};

export type AdminDashboardStatsResponse = {
  ok: boolean;
  orderCount: number;
  orderPayableTotal: number;
  orderCountLast30Days: number;
  ordersDailyLast30Days: AdminDashboardDailyOrderPoint[];
  /** 按 `order_status` 汇总；含常见状态 0 条 */
  ordersByStatus?: Array<{ orderStatus: number; count: number }>;
  modelCount: number;
  merchantCount: number;
  brokerCount: number;
  agentCount: number;
  message?: string;
  code?: string;
};

export async function fetchAdminDashboardStats(): Promise<{
  orderCount: number;
  orderPayableTotal: number;
  orderCountLast30Days: number;
  ordersDailyLast30Days: AdminDashboardDailyOrderPoint[];
  ordersByStatus: Array<{ orderStatus: number; count: number }>;
  modelCount: number;
  merchantCount: number;
  brokerCount: number;
  agentCount: number;
}> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/stats/dashboard"), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminDashboardStatsResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  const daily = Array.isArray(data.ordersDailyLast30Days) ? data.ordersDailyLast30Days : [];
  const byStatusRaw = data.ordersByStatus;
  const ordersByStatus = Array.isArray(byStatusRaw)
    ? byStatusRaw.map((x) => ({
        orderStatus: typeof x.orderStatus === "number" ? x.orderStatus : Number(x.orderStatus ?? 0),
        count: typeof x.count === "number" ? x.count : Number(x.count ?? 0)
      }))
    : [];

  return {
    orderCount: data.orderCount,
    orderPayableTotal: data.orderPayableTotal,
    orderCountLast30Days:
      typeof data.orderCountLast30Days === "number" ? data.orderCountLast30Days : 0,
    ordersDailyLast30Days: daily.map((p) => ({
      date: typeof p.date === "string" ? p.date : "",
      count: typeof p.count === "number" ? p.count : 0
    })),
    ordersByStatus,
    modelCount: data.modelCount,
    merchantCount: data.merchantCount,
    brokerCount: data.brokerCount,
    agentCount: typeof data.agentCount === "number" ? data.agentCount : 0
  };
}

/**
 * 分路径列表（与后端 `admin.routes` 一一对应）。
 * 不走 `GET /api/admin/users`：避免运行中的旧后端未注册 `/users` 时三个列表全部 404。
 */
const ADMIN_LIST_PATH: Record<AdminListKind, string> = {
  models: "/api/admin/models",
  merchants: "/api/admin/merchants",
  brokers: "/api/admin/brokers"
};

export type AdminOrderPartyItem = {
  role: "merchant" | "model" | "broker" | "agent";
  roleLabel: string;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName?: string | null;
};

export type AdminOrderRow = {
  parties?: AdminOrderPartyItem[];
  orderId: number;
  orderNo: string;
  merchantUserId: number;
  merchantUserNo: string;
  merchantNickname: string;
  modelUserId: number;
  modelUserNo: string;
  modelNickname: string;
  brokerUserId: number | null;
  agentUserId: number | null;
  bookingDate: string;
  durationKind: string;
  hourCount: number | null;
  unitPriceSnapshot: number;
  serviceAmount: number;
  platformFee: number;
  payableAmount: number;
  modelIncome: number | null;
  brokerIncome: number | null;
  agentIncome: number | null;
  splitCalculatedAt: string | null;
  /** 分账状态：非已完成为 "-"；已完成为「待分账」或「已分账」 */
  splitStatusLabel?: "-" | "待分账" | "已分账";
  paymentStatus: number;
  paymentChannel: string | null;
  paidAt: string | null;
  orderStatus: number;
  createdAt: string;
};

export type AdminOrderParty = {
  userId: number | null;
  userNo: string | null;
  nickname: string | null;
  realName: string | null;
  phone: string | null;
  companyName?: string | null;
};

export type AdminOrderDetail = AdminOrderRow & {
  remark: string | null;
  updatedAt: string;
  splitConfigSnapshot: unknown;
  merchantPhone?: string | null;
  modelPhone?: string | null;
  merchant?: AdminOrderParty;
  model?: AdminOrderParty;
  broker?: AdminOrderParty | null;
  agent?: AdminOrderParty | null;
};

export type AdminOrderDetailResponse = {
  ok: boolean;
  order?: AdminOrderDetail;
  message?: string;
  code?: string;
};

export type AdminSplitRules = {
  ok?: boolean;
  id: number;
  serviceType?: "ordinary" | "agent";
  platformFeeRateBp: number;
  modelShareBp: number;
  platformShareOfFeeBp: number;
  agentShareOfFeeBp: number;
  brokerShareOfFeeBp: number;
  remark: string | null;
  updatedAt: string;
  message?: string;
  code?: string;
};

export type AdminSplitRulesUpdateBody = {
  serviceType?: "ordinary" | "agent";
  platformFeeRateBp: number;
  modelShareBp: number;
  platformShareOfFeeBp: number;
  agentShareOfFeeBp: number;
  brokerShareOfFeeBp: number;
};

export async function fetchAdminSplitRules(serviceType: "ordinary" | "agent" = "ordinary"): Promise<AdminSplitRules> {
  const token = getAdminToken();
  const qs = new URLSearchParams({ serviceType });
  const res = await fetch(adminApiUrl(`/api/admin/split-rules?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminSplitRules;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function updateAdminSplitRules(body: AdminSplitRulesUpdateBody): Promise<AdminSplitRules> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/split-rules"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as AdminSplitRules;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return data;
}

export type AdminSystemSettings = {
  ok?: boolean;
  merchantOrderEnabled: boolean;
  platformMaintenanceEnabled: boolean;
  platformMaintenanceMessage: string;
  homeStatModelOffset: number;
  homeStatMerchantOffset: number;
  homeStatBrokerOffset: number;
  updatedAt: string;
  message?: string;
  code?: string;
};

export async function fetchAdminSystemSettings(): Promise<AdminSystemSettings> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/system-settings"), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminSystemSettings;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function updateAdminSystemSettings(body: {
  merchantOrderEnabled: boolean;
  platformMaintenanceEnabled: boolean;
  platformMaintenanceMessage: string;
  homeStatModelOffset: number;
  homeStatMerchantOffset: number;
  homeStatBrokerOffset: number;
}): Promise<AdminSystemSettings> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/system-settings"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as AdminSystemSettings;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return data;
}

/** 合同模板类型（与库 `contract_templates.contract_kind` 一致） */
export type AdminContractKind =
  | "platform_broker"
  | "platform_merchant"
  | "broker_model"
  | "platform_agent";

export type AdminContractTemplateItem = {
  contractKind: AdminContractKind;
  label: string;
  partiesLine: string;
  title: string;
  contentHtml: string;
  updatedAt: string;
};

export type AdminContractTemplatesListResponse = {
  ok?: boolean;
  list?: AdminContractTemplateItem[];
  message?: string;
  code?: string;
};

export async function fetchAdminContractTemplates(): Promise<AdminContractTemplateItem[]> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/contract-templates"), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminContractTemplatesListResponse;
  if (!res.ok || data.ok === false || !Array.isArray(data.list)) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data.list;
}

export async function updateAdminContractTemplate(
  contractKind: AdminContractKind,
  body: { title: string; contentHtml: string }
): Promise<AdminContractTemplateItem> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/contract-templates/${contractKind}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as AdminContractTemplateItem & {
    ok?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  if (!data.contractKind || typeof data.contentHtml !== "string") {
    throw new Error("保存响应异常");
  }
  return {
    contractKind: data.contractKind,
    label: data.label,
    partiesLine: data.partiesLine,
    title: data.title,
    contentHtml: data.contentHtml,
    updatedAt: data.updatedAt
  };
}

export type AdminOrderListResponse = {
  ok: boolean;
  list: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
  code?: string;
};

export async function fetchAdminOrders(
  page: number,
  pageSize: number
): Promise<AdminOrderListResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/orders?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminOrderListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export type AdminPlatformFeeDailyPoint = {
  date: string;
  feeYuan: number;
};

export type AdminPlatformBillingRow = {
  orderId: number;
  orderNo: string;
  platformFee: number;
  creditedAt: string | null;
  paidAt: string | null;
  splitCalculatedAt: string | null;
  orderStatus: number;
  payableAmount: number;
  merchantNickname: string;
  modelNickname: string;
};

export type AdminPlatformBillingResponse = {
  ok: boolean;
  days: number;
  feeTotalYuan: number;
  feeDailyLast30Days: AdminPlatformFeeDailyPoint[];
  list: AdminPlatformBillingRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
  code?: string;
};

export async function fetchAdminPlatformBilling(
  page: number,
  pageSize: number
): Promise<{
  days: number;
  feeTotalYuan: number;
  feeDailyLast30Days: AdminPlatformFeeDailyPoint[];
  list: AdminPlatformBillingRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/platform-billing?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminPlatformBillingResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  const list = Array.isArray(data.list) ? data.list : [];
  const feeDailyRaw = Array.isArray(data.feeDailyLast30Days)
    ? data.feeDailyLast30Days
    : [];
  const feeDailyLast30Days = feeDailyRaw.map((p) => ({
    date: typeof p.date === "string" ? p.date : "",
    feeYuan: typeof p.feeYuan === "number" ? p.feeYuan : Number(p.feeYuan ?? 0)
  }));
  return {
    days: typeof data.days === "number" ? data.days : 30,
    feeTotalYuan: typeof data.feeTotalYuan === "number" ? data.feeTotalYuan : 0,
    feeDailyLast30Days,
    list,
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize
  };
}

export type AdminPlatformLedgerRow = {
  flowNo: string;
  orderId: number;
  orderNo: string;
  amountYuan: number;
  balanceAfterYuan: number;
  bizType: "settled" | "pending";
  bizTypeLabel: string;
  creditedAt: string | null;
  paidAt: string | null;
  splitCalculatedAt: string | null;
  orderStatus: number;
  payableAmount: number;
  merchantNickname: string;
  modelNickname: string;
};

export type AdminPlatformLedgerQuery = {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  settleStatus?: "all" | "settled" | "pending";
};

export type AdminPlatformLedgerResponse = {
  ok: boolean;
  list: AdminPlatformLedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  filteredTotalYuan: number;
  todayYuan: number;
  monthYuan: number;
  allTimeYuan: number;
  message?: string;
  code?: string;
};

export async function fetchAdminPlatformLedger(
  query: AdminPlatformLedgerQuery
): Promise<{
  list: AdminPlatformLedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  filteredTotalYuan: number;
  todayYuan: number;
  monthYuan: number;
  allTimeYuan: number;
}> {
  const token = getAdminToken();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    settleStatus: query.settleStatus ?? "all"
  });
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.keyword) params.set("keyword", query.keyword);

  const res = await fetch(adminApiUrl(`/api/admin/platform-ledger?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminPlatformLedgerResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  const list = Array.isArray(data.list) ? data.list : [];
  return {
    list,
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize,
    filteredTotalYuan:
      typeof data.filteredTotalYuan === "number" ? data.filteredTotalYuan : 0,
    todayYuan: typeof data.todayYuan === "number" ? data.todayYuan : 0,
    monthYuan: typeof data.monthYuan === "number" ? data.monthYuan : 0,
    allTimeYuan: typeof data.allTimeYuan === "number" ? data.allTimeYuan : 0
  };
}

export async function fetchAdminOrderDetail(orderId: number): Promise<AdminOrderDetail> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/orders/item/${orderId}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  let data: AdminOrderDetailResponse;
  try {
    data = (await res.json()) as AdminOrderDetailResponse;
  } catch {
    throw new Error(`订单详情请求失败（${res.status}，响应非 JSON；若在浏览器地址栏直接打开接口地址，需带登录态或改用后台页面「详情」）`);
  }
  if (!res.ok || data.ok === false || !data.order) {
    if (res.status === 401) {
      throw new Error("未登录或登录已失效，请重新登录后台后再打开订单详情");
    }
    if (
      res.status === 404 &&
      typeof data.message === "string" &&
      /route not found/i.test(data.message)
    ) {
      throw new Error(
        "后端未提供该接口（请部署含「GET /api/admin/orders/item/:orderId」的 xinglian-server 并重启）"
      );
    }
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data.order;
}

export type AdminOrderSplitResponse = {
  ok?: boolean;
  order?: AdminOrderDetail;
  message?: string;
  code?: string;
};

export type AdminOrderSplitPreview = {
  orderId: number;
  orderNo: string;
  payableAmountYuan: number;
  platformFeeRateBp: number;
  modelShareBp: number;
  platformShareOfFeeBp: number;
  brokerShareOfFeeBp: number;
  agentShareOfFeeBp: number;
  amountsYuan: {
    platformFee: number;
    modelIncome: number;
    brokerIncome: number;
    agentIncome: number;
  };
  modelUserId: number;
  brokerUserId: number | null;
  agentUserId: number | null;
  /** 后端：order_complete_snapshot 为订单完成时锁定；platform_table_live 为旧订单回退读当前配置 */
  rulesSource?: "order_complete_snapshot" | "platform_table_live";
};

export type AdminOrderSplitPreviewResponse = {
  ok?: boolean;
  preview?: AdminOrderSplitPreview;
  message?: string;
  code?: string;
};

/** 管理端：预览即将执行的分账（不落库） */
export async function fetchAdminOrderSplitPreview(orderId: number): Promise<AdminOrderSplitPreview> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/orders/item/${orderId}/split-preview`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminOrderSplitPreviewResponse;
  if (!res.ok || data.ok === false || !data.preview) {
    throw new Error(data.message || data.code || `预览失败 (${res.status})`);
  }
  return data.preview;
}

/** 管理端：对已完成且未分账订单执行分账（写 orders + 账户流水） */
export async function postAdminOrderSplit(orderId: number): Promise<AdminOrderDetail> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/orders/item/${orderId}/split`), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminOrderSplitResponse;
  if (!res.ok || data.ok === false || !data.order) {
    throw new Error(data.message || data.code || `分账失败 (${res.status})`);
  }
  return data.order;
}

async function fetchBrokerUserListPage(
  page: number,
  pageSize: number,
  token: string
): Promise<AdminUserListResponse> {
  const attempts: Array<{ path: string; params: URLSearchParams }> = [
    {
      path: "/api/admin/brokers",
      params: new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    },
    {
      path: "/api/admin/agents",
      params: new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    },
    {
      path: "/api/admin/users",
      params: new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        role: "3"
      })
    }
  ];

  let lastDetail = "";

  for (const { path, params } of attempts) {
    const url = adminApiUrl(`${path}?${params}`);
    if (import.meta.env.DEV) {
      console.debug("[xinglian-admin] GET broker try", url);
    }

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    let data: AdminUserListResponse;
    try {
      data = (await res.json()) as AdminUserListResponse;
    } catch {
      lastDetail = `解析响应失败 (${res.status})`;
      continue;
    }

    if (res.ok && data.ok !== false) {
      return data;
    }

    if (res.status === 404) {
      lastDetail = data.message || `${path} 404`;
      continue;
    }

    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }

  throw new Error(
    lastDetail ||
      "经纪人列表不可用：后端需至少提供 GET /api/admin/brokers、/api/admin/agents 或 GET /api/admin/users?role=3 之一，并已重启服务"
  );
}

export async function fetchAdminUsersByRole(
  kind: AdminListKind,
  page: number,
  pageSize: number,
  filters: { profileAuditStatus?: number; modelLevel?: number } = {}
): Promise<AdminUserListResponse> {
  const token = getAdminToken();

  if (kind === "brokers") {
    return fetchBrokerUserListPage(page, pageSize, token);
  }

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (typeof filters.profileAuditStatus === "number") {
    params.set("profileAuditStatus", String(filters.profileAuditStatus));
  }
  if (typeof filters.modelLevel === "number") {
    params.set("modelLevel", String(filters.modelLevel));
  }
  const url = adminApiUrl(`${ADMIN_LIST_PATH[kind]}?${params}`);
  if (import.meta.env.DEV) {
    console.debug("[xinglian-admin] GET", url);
  }

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminUserListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export type AdminModelProfileAuditBody = {
  decision: "approve" | "reject";
  rejectReason?: string;
};

export type ModelContentReviewSection = "card" | "portfolio" | "stylePosition";

export type ModelContentReviewItem = {
  status: number;
  rejectReason: string | null;
  pendingCount: number;
  rejectedCount: number;
};

export type ModelPhotoReviewFields = {
  reviewStatus?: number;
  rejectReason?: string;
};

export type ModelContentReviewState = {
  card: ModelContentReviewItem;
  portfolio: ModelContentReviewItem;
  stylePosition: ModelContentReviewItem;
};

export type AdminModelContentReviewBody = {
  section: ModelContentReviewSection;
  decision: "approve" | "reject";
  photoIds?: string[];
  rejectReason?: string;
};

export async function postAdminModelContentReview(
  userId: number,
  body: AdminModelContentReviewBody
): Promise<{ section: ModelContentReviewSection; status: number; updatedCount?: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}/content-review`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as {
    ok?: boolean;
    section?: ModelContentReviewSection;
    status?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    section: data.section || body.section,
    status: typeof data.status === "number" ? data.status : 0
  };
}

export async function postAdminModelProfileAudit(
  userId: number,
  body: AdminModelProfileAuditBody
): Promise<{ profileAuditStatus: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}/profile-audit`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as {
    ok?: boolean;
    profileAuditStatus?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    profileAuditStatus: typeof data.profileAuditStatus === "number" ? data.profileAuditStatus : 0
  };
}

export type AdminAgentRow = {
  userId: number;
  userNo: string;
  nickname: string;
  companyName: string;
  avatarUrl: string | null;
  phone: string | null;
  contactName: string | null;
  contactPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: number;
  verifiedStatus: number;
  realName: string | null;
  city: string | null;
  businessLicenseUrl: string | null;
  boundModelCount: number;
  platformAgentContractSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAgentFormBody = {
  companyName: string;
  contactName: string;
  contactPhone: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  city: string;
  businessLicenseUrl: string;
  status: number;
};

export type AdminAgentListResponse = {
  ok?: boolean;
  list?: AdminAgentRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  code?: string;
};

export async function fetchAdminAgents(
  page: number,
  pageSize: number
): Promise<{ list: AdminAgentRow[]; total: number; page: number; pageSize: number }> {
  const token = getAdminToken();
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await fetch(adminApiUrl(`/api/admin/agents?${qs}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminAgentListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    list: Array.isArray(data.list) ? data.list : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : pageSize
  };
}

function mapAdminAgentRowToUserOption(a: AdminAgentRow): AdminUserRow {
  return {
    userId: a.userId,
    userNo: a.userNo,
    nickname: a.companyName || a.nickname,
    avatarUrl: a.avatarUrl,
    role: 4,
    phone: a.phone,
    status: a.status,
    verifiedStatus: a.verifiedStatus,
    profileAuditStatus: 2,
    orderEnabled: null,
    modelContractSignedAt: null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

/** 模特绑定代理人下拉：拉取全部代理人（接口 pageSize 上限 100） */
export async function fetchAdminAgentUsers(): Promise<{ list: AdminUserRow[]; total: number }> {
  const pageSize = 100;
  const first = await fetchAdminAgents(1, pageSize);
  const agents = [...first.list];
  let page = 2;
  while (agents.length < first.total) {
    const next = await fetchAdminAgents(page, pageSize);
    if (!next.list.length) break;
    agents.push(...next.list);
    page += 1;
  }
  return {
    total: first.total,
    list: agents.map(mapAdminAgentRowToUserOption)
  };
}

export type AdminAgentBoundModelRow = {
  userId: number;
  userNo: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  status: number;
  verifiedStatus: number;
  profileAuditStatus: number;
  city: string | null;
  orderEnabled: boolean | null;
  modelContractSignedAt: string | null;
  createdAt: string;
};

export type AdminAgentBoundModelListResponse = {
  ok: boolean;
  list: AdminAgentBoundModelRow[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
  code?: string;
};

export type AdminAgentIncomeLedgerRow = {
  id: number;
  amountYuan: number;
  balanceAfterYuan: number | null;
  bizType: string;
  bizTypeLabel: string;
  orderId: number | null;
  orderNo: string | null;
  title: string | null;
  createdAt: string;
};

export type AdminAgentIncomeLedgerResponse = {
  ok: boolean;
  list: AdminAgentIncomeLedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  wallet: {
    availableYuan: number;
    frozenYuan: number;
    ledgerTableReady: boolean;
    allTimeIncomeYuan: number;
  };
  message?: string;
  code?: string;
};

export async function fetchAdminAgentBoundModels(
  userId: number,
  page: number,
  pageSize: number
): Promise<AdminAgentBoundModelListResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/agents/${userId}/bound-models?${params}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminAgentBoundModelListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchAdminAgentIncomeLedger(
  userId: number,
  page: number,
  pageSize: number
): Promise<AdminAgentIncomeLedgerResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/agents/${userId}/income-ledger?${params}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as AdminAgentIncomeLedgerResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchAdminAgentDetail(userId: number): Promise<AdminAgentRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/agents/${userId}`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; agent?: AdminAgentRow; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.agent) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data.agent;
}

export async function fetchAdminModelCategoryTree(): Promise<AdminModelCategoryTree> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/models/category-tree"), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as {
    ok?: boolean;
    tree?: AdminModelCategoryTree;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.tree) {
    throw new Error(data.message || data.code || `分类加载失败 (${res.status})`);
  }
  return data.tree;
}

export type AdminModelImageUploadKind = "avatar" | "card" | "portfolio" | "style";

export async function uploadAdminModelImage(
  kind: AdminModelImageUploadKind,
  file: File
): Promise<string> {
  const token = getAdminToken();
  const uploadFile = await prepareAdminUploadFile(file);
  const fd = new FormData();
  fd.append("file", uploadFile);
  const res = await fetch(adminApiUrl(`/api/admin/models/${kind}/upload`), {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd
  });
  const data = (await res.json()) as { ok?: boolean; url?: string; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.url) {
    throw new Error(data.message || data.code || `上传失败 (${res.status})`);
  }
  return data.url;
}

export async function uploadAdminAssetImage(file: File): Promise<string> {
  const token = getAdminToken();
  const uploadFile = await prepareAdminUploadFile(file);
  const fd = new FormData();
  fd.append("file", uploadFile);
  const res = await fetch(adminApiUrl("/api/admin/assets/upload"), {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd
  });
  const data = (await res.json()) as { ok?: boolean; url?: string; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.url) {
    throw new Error(data.message || data.code || `上传失败 (${res.status})`);
  }
  return data.url;
}

export async function createAdminModel(body: AdminModelCreateBody): Promise<AdminModelBasicInfo> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/models"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as {
    ok?: boolean;
    basicInfo?: AdminModelBasicInfo;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.basicInfo) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data.basicInfo;
}

export async function updateAdminModel(
  userId: number,
  body: AdminModelCreateBody
): Promise<AdminModelBasicInfo> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as {
    ok?: boolean;
    basicInfo?: AdminModelBasicInfo;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.basicInfo) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return data.basicInfo;
}

export async function createAdminAgent(body: AdminAgentFormBody): Promise<AdminAgentRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl("/api/admin/agents"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as { ok?: boolean; agent?: AdminAgentRow; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.agent) {
    throw new Error(data.message || data.code || `创建失败 (${res.status})`);
  }
  return data.agent;
}

export async function updateAdminAgent(
  userId: number,
  body: Partial<AdminAgentFormBody>
): Promise<AdminAgentRow> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/agents/${userId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json()) as { ok?: boolean; agent?: AdminAgentRow; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.agent) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return data.agent;
}

export async function uploadAdminAgentBusinessLicense(file: File): Promise<string> {
  const token = getAdminToken();
  const uploadFile = await prepareAdminUploadFile(file);
  const fd = new FormData();
  fd.append("file", uploadFile);
  const res = await fetch(adminApiUrl("/api/admin/agents/license/upload"), {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd
  });
  const data = (await res.json()) as { ok?: boolean; url?: string; message?: string; code?: string };
  if (!res.ok || data.ok === false || !data.url) {
    throw new Error(data.message || data.code || `上传失败 (${res.status})`);
  }
  return data.url;
}

export async function deleteAdminAgent(userId: number, unbindModels = false): Promise<void> {
  const token = getAdminToken();
  const qs = unbindModels ? "?unbindModels=1" : "";
  const res = await fetch(adminApiUrl(`/api/admin/agents/${userId}${qs}`), {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; code?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `删除失败 (${res.status})`);
  }
}

export async function patchAdminModelAgent(
  modelUserId: number,
  agentUserId: number | null
): Promise<{ agentUserId: number | null }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/agent`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ agentUserId })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    agentUserId?: number | null;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    agentUserId: data.agentUserId ?? null
  };
}

export async function patchAdminModelFeatured(
  modelUserId: number,
  isPlatformFeatured: boolean
): Promise<{ isPlatformFeatured: boolean }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/featured`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ isPlatformFeatured })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    isPlatformFeatured?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    isPlatformFeatured: Boolean(data.isPlatformFeatured)
  };
}

export async function patchAdminModelPhotosDisabled(
  modelUserId: number,
  photosDisabled: boolean
): Promise<{ photosDisabled: boolean }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/photos-disabled`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ photosDisabled })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    photosDisabled?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    photosDisabled: Boolean(data.photosDisabled)
  };
}

export async function patchAdminModelActivated(
  modelUserId: number,
  isActivated: boolean
): Promise<{ isActivated: boolean }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/activated`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ isActivated })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    isActivated?: boolean;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    isActivated: Boolean(data.isActivated)
  };
}

export async function patchAdminModelAccountStatus(
  modelUserId: number,
  status: 1 | 2
): Promise<{ status: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/status`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ status })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    status?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    status: Number(data.status ?? status)
  };
}

export async function patchAdminBrokerAccountStatus(
  brokerUserId: number,
  status: 1 | 2
): Promise<{ status: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/brokers/${brokerUserId}/status`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ status })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    status?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    status: Number(data.status ?? status)
  };
}

export async function patchAdminModelLevel(
  modelUserId: number,
  modelLevelOverride: AdminModelLevelOverrideValue
): Promise<{ modelLevelOverride: AdminModelLevelOverrideValue }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/level`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ modelLevelOverride })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    modelLevelOverride?: AdminModelLevelOverrideValue;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    modelLevelOverride: parseAdminModelLevelOverride(data.modelLevelOverride)
  };
}

export async function patchAdminModelSortOrder(
  modelUserId: number,
  sortOrder: number
): Promise<{ sortOrder: number }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${modelUserId}/sort-order`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ sortOrder })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    sortOrder?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    sortOrder: Number(data.sortOrder ?? sortOrder)
  };
}

export async function patchAdminMerchantBroker(
  merchantUserId: number,
  brokerUserId: number | null
): Promise<{ brokerUserId: number | null }> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/merchants/${merchantUserId}/broker`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ brokerUserId })
  });
  const data = (await res.json()) as {
    ok?: boolean;
    brokerUserId?: number | null;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `保存失败 (${res.status})`);
  }
  return {
    brokerUserId: data.brokerUserId ?? null
  };
}

/** 商家绑定经纪人下拉：拉取全部经纪人（接口 pageSize 上限 100） */
export async function fetchAdminBrokerUsers(): Promise<{ list: AdminUserRow[]; total: number }> {
  const pageSize = 100;
  const first = await fetchAdminUsersByRole("brokers", 1, pageSize);
  const brokers = [...(first.list || [])];
  let page = 2;
  while (brokers.length < (first.total ?? 0)) {
    const next = await fetchAdminUsersByRole("brokers", page, pageSize);
    if (!next.list?.length) break;
    brokers.push(...next.list);
    page += 1;
  }
  return {
    total: first.total ?? brokers.length,
    list: brokers
  };
}

export async function fetchAdminModelDetail(userId: number): Promise<AdminModelBasicInfo> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}/detail`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as {
    ok?: boolean;
    basicInfo?: AdminModelBasicInfo;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.basicInfo) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  const bi = data.basicInfo;
  return {
    ...bi,
    portfolio: bi.portfolio ?? { folders: [], photos: [] },
    honors: Array.isArray(bi.honors) ? bi.honors : [],
    profileAuditStatus: typeof bi.profileAuditStatus === "number" ? bi.profileAuditStatus : 0,
    profileAuditRejectReason:
      bi.profileAuditRejectReason != null ? String(bi.profileAuditRejectReason) : null
  };
}

export type AdminFinancePeriodExpense = {
  orderCount: number;
  expenseYuan: number;
};

export type AdminMerchantExpenseStatsPayload = {
  stats: {
    today: AdminFinancePeriodExpense;
    week: AdminFinancePeriodExpense;
    month: AdminFinancePeriodExpense;
    allTimeExpenseYuan: number;
    unpaidPayableYuan: number;
    trend7d: Array<{ date: string; expense: number }>;
  };
};

export type AdminModelIncomePeriod = {
  orderCount: number;
  income: number;
  pendingSettlement: number;
};

export type AdminModelIncomeStatsPayload = {
  stats: {
    today: AdminModelIncomePeriod;
    week: AdminModelIncomePeriod;
    month: AdminModelIncomePeriod;
    trend7d: Array<{ date: string; income: number }>;
  };
  wallet: {
    availableYuan: number;
    frozenYuan: number;
    ledgerTableReady: boolean;
  };
  allTimeIncomeYuan: number;
  lifetimeOrderCount: number;
};

export type AdminBrokerIncomePeriod = {
  brokerIncomeYuan: number;
  agentIncomeYuan: number;
  totalYuan: number;
  pendingSettlementYuan: number;
};

export type AdminBrokerIncomeStatsPayload = {
  stats: {
    lockedMerchantCount: number;
    today: AdminBrokerIncomePeriod;
    week: AdminBrokerIncomePeriod;
    month: AdminBrokerIncomePeriod;
    trend7d: Array<{ date: string; income: number }>;
  };
  wallet: {
    availableYuan: number;
    frozenYuan: number;
    ledgerTableReady: boolean;
  };
  allTimeIncomeYuan: number;
};

async function parseAdminJson<T>(res: Response): Promise<T & { ok?: boolean; message?: string; code?: string }> {
  return (await res.json()) as T & { ok?: boolean; message?: string; code?: string };
}

export async function fetchAdminMerchantExpenseStats(
  userId: number
): Promise<AdminMerchantExpenseStatsPayload> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/merchants/${userId}/expense-stats`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = await parseAdminJson<{ stats?: AdminMerchantExpenseStatsPayload["stats"] }>(res);
  if (!res.ok || data.ok === false || !data.stats) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return { stats: data.stats };
}

export async function fetchAdminModelIncomeStats(userId: number): Promise<AdminModelIncomeStatsPayload> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}/income-stats`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = await parseAdminJson<Partial<AdminModelIncomeStatsPayload>>(res);
  if (!res.ok || data.ok === false || !data.stats) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    stats: data.stats,
    wallet: data.wallet ?? { availableYuan: 0, frozenYuan: 0, ledgerTableReady: false },
    allTimeIncomeYuan: typeof data.allTimeIncomeYuan === "number" ? data.allTimeIncomeYuan : 0,
    lifetimeOrderCount: typeof data.lifetimeOrderCount === "number" ? data.lifetimeOrderCount : 0
  };
}

export async function fetchAdminBrokerIncomeStats(
  userId: number
): Promise<AdminBrokerIncomeStatsPayload> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/brokers/${userId}/income-stats`), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = await parseAdminJson<Partial<AdminBrokerIncomeStatsPayload>>(res);
  if (!res.ok || data.ok === false || !data.stats) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return {
    stats: data.stats,
    wallet: data.wallet ?? { availableYuan: 0, frozenYuan: 0, ledgerTableReady: false },
    allTimeIncomeYuan: typeof data.allTimeIncomeYuan === "number" ? data.allTimeIncomeYuan : 0
  };
}

export async function fetchAdminMerchantDetail(userId: number): Promise<AdminMerchantBasicInfo> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/merchants/${userId}/detail`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as {
    ok?: boolean;
    basicInfo?: AdminMerchantBasicInfo;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.basicInfo) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data.basicInfo;
}

export async function fetchAdminMerchantOrders(
  userId: number,
  page: number,
  pageSize: number
): Promise<AdminOrderListResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/merchants/${userId}/orders?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminOrderListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchAdminModelOrders(
  userId: number,
  page: number,
  pageSize: number
): Promise<AdminOrderListResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/models/${userId}/orders?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminOrderListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchAdminBrokerDetail(userId: number): Promise<AdminBrokerBasicInfo> {
  const token = getAdminToken();
  const res = await fetch(adminApiUrl(`/api/admin/brokers/${userId}/detail`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as {
    ok?: boolean;
    basicInfo?: AdminBrokerBasicInfo;
    message?: string;
    code?: string;
  };
  if (!res.ok || data.ok === false || !data.basicInfo) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data.basicInfo;
}

export async function fetchAdminBrokerBoundMerchants(
  userId: number,
  page: number,
  pageSize: number
): Promise<AdminBrokerBoundMerchantListResponse> {
  const token = getAdminToken();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const res = await fetch(adminApiUrl(`/api/admin/brokers/${userId}/bound-merchants?${params}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = (await res.json()) as AdminBrokerBoundMerchantListResponse;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.code || `请求失败 (${res.status})`);
  }
  return data;
}
