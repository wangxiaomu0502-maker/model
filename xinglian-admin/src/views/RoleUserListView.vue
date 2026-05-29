<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Right } from "@element-plus/icons-vue";
import ModelCreateDialog from "@/components/ModelCreateDialog.vue";
import {
  fetchAdminAgentUsers,
  fetchAdminBrokerUsers,
  fetchAdminBrokerBoundMerchants,
  fetchAdminBrokerDetail,
  fetchAdminBrokerIncomeStats,
  fetchAdminMerchantDetail,
  fetchAdminMerchantExpenseStats,
  fetchAdminMerchantOrders,
  fetchAdminModelDetail,
  fetchAdminModelIncomeStats,
  fetchAdminModelOrders,
  fetchAdminUsersByRole,
  patchAdminModelAgent,
  patchAdminMerchantBroker,
  postAdminModelProfileAudit,
  type AdminListKind,
  type AdminBrokerBasicInfo,
  type AdminBrokerBoundMerchantRow,
  type AdminBrokerIncomeStatsPayload,
  type AdminMerchantBasicInfo,
  type AdminMerchantExpenseStatsPayload,
  type AdminModelBasicInfo,
  type AdminModelIncomeStatsPayload,
  type AdminOrderRow,
  type AdminUserRow
} from "@/api/admin";
import AdminUserFinanceStatsPanel from "@/components/AdminUserFinanceStatsPanel.vue";
import { getAdminToken } from "@/composables/useAdminToken";

const route = useRoute();
const modelCreateVisible = ref(false);
const modelEditingInfo = ref<AdminModelBasicInfo | null>(null);

const listKind = computed<AdminListKind>(() => {
  const k = route.meta.listKind;
  if (k === "merchants") return "merchants";
  if (k === "brokers") return "brokers";
  return "models";
});

const pageTitle = computed(() => (route.meta.title as string) || "列表");
const isModelList = computed(() => listKind.value === "models");
const isMerchantList = computed(() => listKind.value === "merchants");
const isBrokerList = computed(() => listKind.value === "brokers");

const bindBrokerDialogTitle = computed(() =>
  bindBrokerMerchantRow.value?.referrerBrokerUserId ? "换绑经纪人" : "绑定经纪人"
);

function partyInitial(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return "?";
  return n.slice(0, 1);
}

function partyHue(seed: string): number {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 200 + (h % 140);
}

function displayCellName(n: string | null | undefined): string {
  const x = n?.trim();
  return x ? x : "—";
}

const listPageSummary = computed(() => {
  const rows = list.value;
  let normal = 0;
  let disabled = 0;
  let auditPending = 0;
  for (const r of rows) {
    if (r.status === 1) normal += 1;
    if (r.status === 2) disabled += 1;
    if (r.profileAuditStatus === 1) auditPending += 1;
  }
  return { showing: rows.length, normal, disabled, auditPending };
});

const loading = ref(false);
const list = ref<AdminUserRow[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailBasicInfo = ref<AdminModelBasicInfo | null>(null);
const auditDecisionBusy = ref(false);
const modelOrdersUserId = ref<number | null>(null);
const modelOrdersLoading = ref(false);
const modelOrdersList = ref<AdminOrderRow[]>([]);
const modelOrdersTotal = ref(0);
const modelOrderPager = reactive({
  page: 1,
  pageSize: 10
});
const modelIncomeStatsLoading = ref(false);
const modelIncomeStats = ref<AdminModelIncomeStatsPayload | null>(null);
const agentOptions = ref<AdminUserRow[]>([]);
const agentOptionsLoading = ref(false);
const modelAgentDraft = ref<number | null>(null);
const modelAgentSaving = ref(false);
const bindAgentDialogVisible = ref(false);
const bindAgentModelRow = ref<AdminUserRow | null>(null);
const bindAgentDraft = ref<number | null>(null);
const bindAgentSaving = ref(false);

const brokerOptions = ref<AdminUserRow[]>([]);
const brokerOptionsLoading = ref(false);
const bindBrokerDialogVisible = ref(false);
const bindBrokerMerchantRow = ref<AdminUserRow | null>(null);
const bindBrokerDraft = ref<number | null>(null);
const bindBrokerSaving = ref(false);

const merchantBrokerDraft = ref<number | null>(null);
const merchantBrokerSaving = ref(false);

const merchantDetailVisible = ref(false);
const merchantDetailLoading = ref(false);
const merchantBasicInfo = ref<AdminMerchantBasicInfo | null>(null);
const merchantDetailUserId = ref<number | null>(null);
const merchantOrdersLoading = ref(false);
const merchantOrdersList = ref<AdminOrderRow[]>([]);
const merchantOrdersTotal = ref(0);
const merchantOrderPager = reactive({
  page: 1,
  pageSize: 10
});
const merchantExpenseStatsLoading = ref(false);
const merchantExpenseStats = ref<AdminMerchantExpenseStatsPayload | null>(null);

const brokerDetailVisible = ref(false);
const brokerDetailLoading = ref(false);
const brokerBasicInfo = ref<AdminBrokerBasicInfo | null>(null);
const brokerDetailUserId = ref<number | null>(null);
const brokerMerchantsLoading = ref(false);
const brokerMerchantsList = ref<AdminBrokerBoundMerchantRow[]>([]);
const brokerMerchantsTotal = ref(0);
const brokerMerchantPager = reactive({
  page: 1,
  pageSize: 10
});
const brokerIncomeStatsLoading = ref(false);
const brokerIncomeStats = ref<AdminBrokerIncomeStatsPayload | null>(null);

const pager = reactive({
  page: 1,
  pageSize: 20
});

const STATUS_LABELS: Record<number, string> = {
  1: "正常",
  2: "禁用",
  3: "注销中",
  4: "已注销"
};

const VERIFIED_LABELS: Record<number, string> = {
  2: "已实名",
  1: "审核中",
  3: "驳回",
  0: "未实名"
};

const PROFILE_AUDIT_LABELS: Record<number, string> = {
  0: "待提交",
  1: "审核中",
  2: "审核通过",
  3: "审核失败"
};

const SCHEDULE_STATUS_LABELS: Record<"available" | "full" | "rest", string> = {
  available: "可接单",
  full: "已约满",
  rest: "休息"
};

function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `状态${status}`;
}

function accountStatusTagType(status: number): "success" | "warning" | "danger" | "info" {
  if (status === 1) return "success";
  if (status === 2) return "danger";
  if (status === 3) return "warning";
  if (status === 4) return "info";
  return "info";
}

function wechatBindLabel(row: AdminUserRow): string {
  return row.isWechatBound ? "已绑定" : "未绑定";
}

function wechatBindTagType(row: AdminUserRow): "success" | "info" {
  return row.isWechatBound ? "success" : "info";
}

function verifiedLabel(status: number): string {
  return VERIFIED_LABELS[status] ?? "未实名";
}

function verifiedTagType(status: number): "success" | "warning" | "danger" | "info" {
  if (status === 2) return "success";
  if (status === 1) return "warning";
  if (status === 3) return "danger";
  return "info";
}

function profileAuditLabel(status: number): string {
  return PROFILE_AUDIT_LABELS[status] ?? "待提交";
}

function profileAuditTagType(status: number): "success" | "warning" | "danger" | "info" {
  if (status === 2) return "success";
  if (status === 1) return "warning";
  if (status === 3) return "danger";
  return "info";
}

function scheduleStatusLabel(status: "available" | "full" | "rest"): string {
  return SCHEDULE_STATUS_LABELS[status] ?? "休息";
}

function scheduleStatusClass(status: "available" | "full" | "rest"): string {
  if (status === "available") return "sched-available";
  if (status === "full") return "sched-full";
  return "sched-rest";
}

function scheduleEntries(
  map: Record<string, "available" | "full" | "rest"> | undefined
): Array<{ dateKey: string; status: "available" | "full" | "rest" }> {
  const source = map && typeof map === "object" ? map : {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entries: Array<{ dateKey: string; status: "available" | "full" | "rest" }> = [];
  for (let i = 1; i <= 30; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    const s = source[dateKey];
    entries.push({
      dateKey,
      status: s === "available" || s === "full" || s === "rest" ? s : "rest"
    });
  }
  return entries;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function contractSignedLabel(signedAt: string | null): string {
  return signedAt ? "已签署" : "未签署";
}

function contractSignedTagType(signedAt: string | null): "success" | "danger" {
  return signedAt ? "success" : "danger";
}

const MERCHANT_PAYMENT_LABELS: Record<number, string> = {
  0: "未支付",
  1: "已支付",
  2: "退款中",
  3: "已退款",
  4: "退款失败"
};

const MERCHANT_ORDER_STATUS_LABELS: Record<number, string> = {
  1: "待模特确认接单",
  2: "进行中",
  3: "模特已完成",
  4: "已完成",
  9: "已取消"
};

const MERCHANT_ORDER_COMPLETED = 4;

function merchantPaymentLabel(v: number): string {
  return MERCHANT_PAYMENT_LABELS[v] ?? `支付${v}`;
}

function merchantOrderStatusLabel(v: number): string {
  return MERCHANT_ORDER_STATUS_LABELS[v] ?? `状态${v}`;
}

function merchantPaymentTagType(
  status: number
): "info" | "success" | "warning" | "danger" | "primary" {
  if (status === 1) return "success";
  if (status === 2) return "warning";
  if (status === 3) return "danger";
  if (status === 4) return "danger";
  return "info";
}

function merchantOrderStatusTagType(
  status: number
): "info" | "success" | "warning" | "danger" | "primary" {
  if (status === 1) return "warning";
  if (status === 2) return "primary";
  if (status === 3) return "info";
  if (status === 4) return "success";
  if (status === 9) return "danger";
  return "info";
}

function merchantSplitStatusCell(row: AdminOrderRow): "-" | "待分账" | "已分账" {
  const fromApi = row.splitStatusLabel;
  if (fromApi === "待分账" || fromApi === "已分账" || fromApi === "-") return fromApi;
  if (row.orderStatus !== MERCHANT_ORDER_COMPLETED) return "-";
  return row.splitCalculatedAt == null || row.splitCalculatedAt === "" ? "待分账" : "已分账";
}

function merchantSplitStatusTagType(row: AdminOrderRow): "warning" | "success" {
  return merchantSplitStatusCell(row) === "已分账" ? "success" : "warning";
}

function formatOrderAmt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(2);
}

function formatReferrerBrokerLine(
  b: { userNo: string | null; nickname: string | null; realName: string | null } | null
): string {
  if (!b) return "—";
  const real = b.realName?.trim();
  const nick = b.nickname?.trim();
  const no = b.userNo?.trim();
  const parts = [real, nick, no].filter((x) => Boolean(x));
  return parts.length > 0 ? parts.join(" / ") : "—";
}

function formatAgentUserLine(
  a: { userNo: string; nickname: string | null; realName: string | null } | null | undefined
): string {
  if (!a?.userNo) return "—";
  const real = a.realName?.trim();
  const nick = a.nickname?.trim();
  const name = real || nick;
  return name ? `${name} · ${a.userNo}` : a.userNo;
}

function categoryTypeLabel(type: "main" | "style" | "scene"): string {
  if (type === "main") return "类型";
  if (type === "style") return "风格";
  return "场景";
}

function orderEnabledLabel(enabled: boolean | undefined): string {
  return enabled === false ? "暂停接单" : "可接单";
}

function orderEnabledTagType(enabled: boolean | null | undefined): "success" | "danger" {
  return enabled === false ? "danger" : "success";
}

function yesNoLabel(v: boolean | undefined): string {
  return v ? "是" : "否";
}

type PortfolioFolderRow = { id: string; name: string; coverPhotoId?: string };
type PortfolioPhotoRow = { id: string; folderId: string; url: string };

function portfolioPhotosForFolderSorted(
  folder: PortfolioFolderRow,
  photos: PortfolioPhotoRow[]
): PortfolioPhotoRow[] {
  const list = photos.filter((p) => p.folderId === folder.id);
  const cid = folder.coverPhotoId;
  if (!cid) return list;
  return [...list].sort((a, b) => {
    if (a.id === cid) return -1;
    if (b.id === cid) return 1;
    return 0;
  });
}

function portfolioFolderCoverThumbUrl(folder: PortfolioFolderRow, photos: PortfolioPhotoRow[]): string {
  const list = portfolioPhotosForFolderSorted(folder, photos);
  return list[0]?.url || "";
}

function isPortfolioFolderCoverPhoto(folder: PortfolioFolderRow, photoId: string): boolean {
  const cid = folder.coverPhotoId;
  return Boolean(cid && cid === photoId);
}

function formatAgentOptionLabel(row: AdminUserRow): string {
  const name = row.nickname?.trim() || "未命名";
  return `${name} · ${row.userNo}`;
}

function formatBrokerOptionLabel(row: AdminUserRow): string {
  return formatAgentOptionLabel(row);
}

async function loadAgentOptions(): Promise<void> {
  agentOptionsLoading.value = true;
  try {
    const data = await fetchAdminAgentUsers();
    agentOptions.value = data.list || [];
    if (!agentOptions.value.length) {
      ElMessage.warning("暂无代理人，请先在「代理人列表」中新增");
    }
  } catch (e) {
    agentOptions.value = [];
    ElMessage.error(e instanceof Error ? e.message : "代理人列表加载失败");
  } finally {
    agentOptionsLoading.value = false;
  }
}

async function onSaveModelAgent(): Promise<void> {
  const uid = detailBasicInfo.value?.userId;
  if (!uid) return;
  modelAgentSaving.value = true;
  try {
    await patchAdminModelAgent(uid, modelAgentDraft.value);
    ElMessage.success("已保存所属代理人");
    detailBasicInfo.value = await fetchAdminModelDetail(uid);
    modelAgentDraft.value = detailBasicInfo.value.agentUserId ?? null;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    modelAgentSaving.value = false;
  }
}

function openBindAgentDialog(row: AdminUserRow): void {
  bindAgentModelRow.value = row;
  bindAgentDraft.value = null;
  bindAgentDialogVisible.value = true;
  void loadAgentOptions();
}

function closeBindAgentDialog(): void {
  bindAgentDialogVisible.value = false;
  bindAgentModelRow.value = null;
  bindAgentDraft.value = null;
}

async function onConfirmBindAgent(): Promise<void> {
  const row = bindAgentModelRow.value;
  if (!row) return;
  if (bindAgentDraft.value == null) {
    ElMessage.warning("请选择代理人");
    return;
  }
  bindAgentSaving.value = true;
  try {
    await patchAdminModelAgent(row.userId, bindAgentDraft.value);
    ElMessage.success("已绑定代理人");
    closeBindAgentDialog();
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "绑定失败");
  } finally {
    bindAgentSaving.value = false;
  }
}

async function loadBrokerOptions(): Promise<void> {
  brokerOptionsLoading.value = true;
  try {
    const data = await fetchAdminBrokerUsers();
    brokerOptions.value = data.list || [];
    if (!brokerOptions.value.length) {
      ElMessage.warning("暂无可用经纪人，请先在「经纪人列表」中新增并完成合同签署");
    }
  } catch (e) {
    brokerOptions.value = [];
    ElMessage.error(e instanceof Error ? e.message : "经纪人列表加载失败");
  } finally {
    brokerOptionsLoading.value = false;
  }
}

function openBindBrokerDialog(row: AdminUserRow): void {
  bindBrokerMerchantRow.value = row;
  bindBrokerDraft.value = row.referrerBrokerUserId ?? null;
  bindBrokerDialogVisible.value = true;
  void loadBrokerOptions();
}

function closeBindBrokerDialog(): void {
  bindBrokerDialogVisible.value = false;
  bindBrokerMerchantRow.value = null;
  bindBrokerDraft.value = null;
}

async function onUnbindMerchantBroker(): Promise<void> {
  const row = bindBrokerMerchantRow.value;
  if (!row?.referrerBrokerUserId) return;
  try {
    await ElMessageBox.confirm(
      `确认解除商家「${displayCellName(row.nickname)}」（${row.userNo}）与当前经纪人的绑定？`,
      "解绑经纪人",
      { type: "warning", confirmButtonText: "解绑", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  bindBrokerSaving.value = true;
  try {
    await patchAdminMerchantBroker(row.userId, null);
    ElMessage.success("已解绑经纪人");
    closeBindBrokerDialog();
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "解绑失败");
  } finally {
    bindBrokerSaving.value = false;
  }
}

async function onConfirmBindBroker(): Promise<void> {
  const row = bindBrokerMerchantRow.value;
  if (!row) return;
  if (bindBrokerDraft.value == null) {
    ElMessage.warning("请选择经纪人，或使用「解绑」解除当前绑定");
    return;
  }
  if (bindBrokerDraft.value === row.referrerBrokerUserId) {
    ElMessage.info("绑定关系未变更");
    return;
  }
  bindBrokerSaving.value = true;
  try {
    await patchAdminMerchantBroker(row.userId, bindBrokerDraft.value);
    ElMessage.success(row.referrerBrokerUserId ? "已更换绑定经纪人" : "已绑定经纪人");
    closeBindBrokerDialog();
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    bindBrokerSaving.value = false;
  }
}

async function onSaveMerchantBroker(): Promise<void> {
  const uid = merchantBasicInfo.value?.userId;
  if (!uid) return;
  const prevId = merchantBasicInfo.value?.referrerBroker?.userId ?? null;
  if (merchantBrokerDraft.value === prevId) {
    ElMessage.info("绑定关系未变更");
    return;
  }
  merchantBrokerSaving.value = true;
  try {
    await patchAdminMerchantBroker(uid, merchantBrokerDraft.value);
    ElMessage.success(
      merchantBrokerDraft.value == null
        ? "已解绑经纪人"
        : prevId != null
          ? "已更换绑定经纪人"
          : "已绑定经纪人"
    );
    merchantBasicInfo.value = await fetchAdminMerchantDetail(uid);
    merchantBrokerDraft.value = merchantBasicInfo.value.referrerBroker?.userId ?? null;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    merchantBrokerSaving.value = false;
  }
}

async function onViewModelDetail(row: AdminUserRow): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detailBasicInfo.value = null;
  modelOrdersUserId.value = row.userId;
  modelOrderPager.page = 1;
  modelOrdersList.value = [];
  modelOrdersTotal.value = 0;
  modelIncomeStats.value = null;
  modelIncomeStatsLoading.value = true;
  modelAgentDraft.value = null;
  void loadAgentOptions();
  try {
    const [info, ord, income] = await Promise.all([
      fetchAdminModelDetail(row.userId),
      fetchAdminModelOrders(row.userId, modelOrderPager.page, modelOrderPager.pageSize),
      fetchAdminModelIncomeStats(row.userId).catch(() => null)
    ]);
    detailBasicInfo.value = info;
    modelAgentDraft.value = info.agentUserId ?? null;
    modelOrdersList.value = ord.list || [];
    modelOrdersTotal.value = ord.total ?? 0;
    modelIncomeStats.value = income;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "详情加载失败");
    detailVisible.value = false;
    modelOrdersUserId.value = null;
    modelIncomeStats.value = null;
  } finally {
    detailLoading.value = false;
    modelIncomeStatsLoading.value = false;
  }
}

async function onEditModel(row: AdminUserRow): Promise<void> {
  if (row.isAdminCreated !== true) {
    ElMessage.warning("仅后管创建的模特允许编辑");
    return;
  }
  try {
    const info = await fetchAdminModelDetail(row.userId);
    if (info.isAdminCreated !== true) {
      ElMessage.warning("仅后管创建的模特允许编辑");
      return;
    }
    modelEditingInfo.value = info;
    modelCreateVisible.value = true;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "模特资料加载失败");
  }
}

function openCreateModelDialog(): void {
  modelEditingInfo.value = null;
  modelCreateVisible.value = true;
}

async function onModelSaved(): Promise<void> {
  modelEditingInfo.value = null;
  await loadList();
}

async function loadModelOrdersPage(): Promise<void> {
  const uid = modelOrdersUserId.value;
  if (!uid) return;
  modelOrdersLoading.value = true;
  try {
    const data = await fetchAdminModelOrders(uid, modelOrderPager.page, modelOrderPager.pageSize);
    modelOrdersList.value = data.list || [];
    modelOrdersTotal.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "订单列表加载失败");
    modelOrdersList.value = [];
    modelOrdersTotal.value = 0;
  } finally {
    modelOrdersLoading.value = false;
  }
}

function onModelOrderPageChange(p: number): void {
  modelOrderPager.page = p;
  void loadModelOrdersPage();
}

function onModelOrderSizeChange(s: number): void {
  modelOrderPager.pageSize = s;
  modelOrderPager.page = 1;
  void loadModelOrdersPage();
}

async function loadMerchantOrdersPage(): Promise<void> {
  const uid = merchantDetailUserId.value;
  if (!uid) return;
  merchantOrdersLoading.value = true;
  try {
    const data = await fetchAdminMerchantOrders(
      uid,
      merchantOrderPager.page,
      merchantOrderPager.pageSize
    );
    merchantOrdersList.value = data.list || [];
    merchantOrdersTotal.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "订单列表加载失败");
    merchantOrdersList.value = [];
    merchantOrdersTotal.value = 0;
  } finally {
    merchantOrdersLoading.value = false;
  }
}

async function onViewMerchantDetail(row: AdminUserRow): Promise<void> {
  merchantDetailVisible.value = true;
  merchantDetailLoading.value = true;
  merchantBasicInfo.value = null;
  merchantDetailUserId.value = row.userId;
  merchantOrderPager.page = 1;
  merchantOrdersList.value = [];
  merchantOrdersTotal.value = 0;
  merchantExpenseStats.value = null;
  merchantExpenseStatsLoading.value = true;
  merchantBrokerDraft.value = null;
  void loadBrokerOptions();
  try {
    const [info, ord, expense] = await Promise.all([
      fetchAdminMerchantDetail(row.userId),
      fetchAdminMerchantOrders(row.userId, merchantOrderPager.page, merchantOrderPager.pageSize),
      fetchAdminMerchantExpenseStats(row.userId).catch(() => null)
    ]);
    merchantBasicInfo.value = info;
    merchantBrokerDraft.value = info.referrerBroker?.userId ?? null;
    merchantOrdersList.value = ord.list || [];
    merchantOrdersTotal.value = ord.total ?? 0;
    merchantExpenseStats.value = expense;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "详情加载失败");
    merchantDetailVisible.value = false;
    merchantDetailUserId.value = null;
    merchantExpenseStats.value = null;
  } finally {
    merchantDetailLoading.value = false;
    merchantExpenseStatsLoading.value = false;
  }
}

function onMerchantOrderPageChange(p: number): void {
  merchantOrderPager.page = p;
  void loadMerchantOrdersPage();
}

function onMerchantOrderSizeChange(s: number): void {
  merchantOrderPager.pageSize = s;
  merchantOrderPager.page = 1;
  void loadMerchantOrdersPage();
}

async function loadBrokerMerchantsPage(): Promise<void> {
  const uid = brokerDetailUserId.value;
  if (!uid) return;
  brokerMerchantsLoading.value = true;
  try {
    const data = await fetchAdminBrokerBoundMerchants(
      uid,
      brokerMerchantPager.page,
      brokerMerchantPager.pageSize
    );
    brokerMerchantsList.value = data.list || [];
    brokerMerchantsTotal.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "绑定商家加载失败");
    brokerMerchantsList.value = [];
    brokerMerchantsTotal.value = 0;
  } finally {
    brokerMerchantsLoading.value = false;
  }
}

async function onViewBrokerDetail(row: AdminUserRow): Promise<void> {
  brokerDetailVisible.value = true;
  brokerDetailLoading.value = true;
  brokerBasicInfo.value = null;
  brokerDetailUserId.value = row.userId;
  brokerMerchantPager.page = 1;
  brokerMerchantsList.value = [];
  brokerMerchantsTotal.value = 0;
  brokerIncomeStats.value = null;
  brokerIncomeStatsLoading.value = true;
  try {
    const [info, merc, income] = await Promise.all([
      fetchAdminBrokerDetail(row.userId),
      fetchAdminBrokerBoundMerchants(row.userId, brokerMerchantPager.page, brokerMerchantPager.pageSize),
      fetchAdminBrokerIncomeStats(row.userId).catch(() => null)
    ]);
    brokerBasicInfo.value = info;
    brokerMerchantsList.value = merc.list || [];
    brokerMerchantsTotal.value = merc.total ?? 0;
    brokerIncomeStats.value = income;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "详情加载失败");
    brokerDetailVisible.value = false;
    brokerDetailUserId.value = null;
    brokerIncomeStats.value = null;
  } finally {
    brokerDetailLoading.value = false;
    brokerIncomeStatsLoading.value = false;
  }
}

function onBrokerMerchantPageChange(p: number): void {
  brokerMerchantPager.page = p;
  void loadBrokerMerchantsPage();
}

function onBrokerMerchantSizeChange(s: number): void {
  brokerMerchantPager.pageSize = s;
  brokerMerchantPager.page = 1;
  void loadBrokerMerchantsPage();
}

async function onApproveModelProfileAudit(): Promise<void> {
  const uid = detailBasicInfo.value?.userId;
  if (!uid) return;
  auditDecisionBusy.value = true;
  try {
    await postAdminModelProfileAudit(uid, { decision: "approve" });
    ElMessage.success("已通过资料审核");
    detailBasicInfo.value = await fetchAdminModelDetail(uid);
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    auditDecisionBusy.value = false;
  }
}

async function onRejectModelProfileAudit(): Promise<void> {
  const uid = detailBasicInfo.value?.userId;
  if (!uid) return;
  let reason: string;
  try {
    const { value } = await ElMessageBox.prompt("请输入驳回原因（将展示给模特）", "驳回资料审核", {
      confirmButtonText: "确定驳回",
      cancelButtonText: "取消",
      inputType: "textarea",
      inputPlaceholder: "例如：模卡全身照不清晰…",
      inputValidator: (v) => {
        if (!v || !String(v).trim()) return "请填写原因";
        return true;
      }
    });
    reason = String(value || "").trim();
  } catch {
    return;
  }
  auditDecisionBusy.value = true;
  try {
    await postAdminModelProfileAudit(uid, { decision: "reject", rejectReason: reason });
    ElMessage.success("已驳回");
    detailBasicInfo.value = await fetchAdminModelDetail(uid);
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    auditDecisionBusy.value = false;
  }
}

async function loadList(): Promise<void> {
  if (!getAdminToken()) {
    ElMessage.warning("请先登录后台账号");
    list.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const data = await fetchAdminUsersByRole(listKind.value, pager.page, pager.pageSize);
    list.value = data.list || [];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number): void {
  pager.page = p;
  void loadList();
}

function onSizeChange(s: number): void {
  pager.pageSize = s;
  pager.page = 1;
  void loadList();
}

function onTokenChanged(): void {
  void loadList();
}

watch(listKind, () => {
  pager.page = 1;
  void loadList();
});

onMounted(() => {
  window.addEventListener("admin-token-changed", onTokenChanged);
  void loadList();
});

onUnmounted(() => {
  window.removeEventListener("admin-token-changed", onTokenChanged);
});
</script>

<template>
  <div class="alv-page">
    <header class="alv-hero">
      <div class="alv-hero-text">
        <h1 class="alv-hero-title">{{ pageTitle }}</h1>
        <p class="alv-hero-sub">
          共 <strong>{{ total }}</strong> 位用户，当前第
          {{ pager.page }} / {{ Math.max(1, Math.ceil(total / pager.pageSize)) }} 页
        </p>
      </div>
      <div v-if="isModelList" class="alv-hero-actions">
        <el-button type="primary" :icon="Plus" @click="openCreateModelDialog">
          新增模特
        </el-button>
      </div>
      <div class="alv-hero-meta">
        <div class="alv-stat alv-stat--muted">
          <span class="alv-stat-label">本页展示</span>
          <span class="alv-stat-val">{{ listPageSummary.showing }}</span>
        </div>
        <div class="alv-stat alv-stat--ok">
          <span class="alv-stat-label">本页账号正常</span>
          <span class="alv-stat-val">{{ listPageSummary.normal }}</span>
        </div>
        <div v-if="listPageSummary.disabled > 0" class="alv-stat alv-stat--danger">
          <span class="alv-stat-label">本页已禁用</span>
          <span class="alv-stat-val">{{ listPageSummary.disabled }}</span>
        </div>
        <div
          v-if="isModelList && listPageSummary.auditPending > 0"
          class="alv-stat alv-stat--warn"
        >
          <span class="alv-stat-label">本页资料审核中</span>
          <span class="alv-stat-val">{{ listPageSummary.auditPending }}</span>
        </div>
      </div>
    </header>

    <el-card class="alv-card" shadow="never">
      <div class="alv-table-wrap">
        <el-table
          v-loading="loading"
          class="alv-table"
          :data="list"
          empty-text="暂无数据"
          row-key="userId"
          :row-class-name="() => 'alv-table-row'"
        >
        <el-table-column label="编号" prop="userNo" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="alv-mono">{{ row.userNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="头像" width="84">
          <template #default="{ row }">
            <el-avatar :size="34" :src="row.avatarUrl || undefined">
              {{ (row.nickname || "用").slice(0, 1) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="昵称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="alv-party">
              <span
                class="alv-party-dot"
                :style="{
                  background: `linear-gradient(145deg, hsl(${partyHue(row.userNo)}, 72%, 90%), hsl(${partyHue(row.userNo)}, 58%, 78%))`,
                  color: `hsl(${partyHue(row.userNo)}, 42%, 28%)`
                }"
              >
                {{ partyInitial(row.nickname) }}
              </span>
              <span class="alv-party-name">{{ displayCellName(row.nickname) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机" min-width="156" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="alv-mono">{{ row.phone || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="listKind === 'models'" label="所属代理人" min-width="200">
          <template #default="{ row }">
            <span v-if="row.agentUserLabel" class="alv-agent-label">{{ row.agentUserLabel }}</span>
            <el-button
              v-else
              type="primary"
              link
              size="small"
              @click.stop="openBindAgentDialog(row)"
            >
              绑定代理人
            </el-button>
          </template>
        </el-table-column>
        <el-table-column
          v-if="listKind === 'merchants'"
          label="绑定经纪人"
          min-width="240"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="alv-broker-cell">
              <span v-if="row.referrerBrokerLabel" class="alv-agent-label">{{ row.referrerBrokerLabel }}</span>
              <span v-else class="alv-muted">—</span>
              <el-button type="primary" link size="small" @click.stop="openBindBrokerDialog(row)">
                {{ row.referrerBrokerUserId ? "换绑" : "绑定" }}
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="账号状态" width="88">
          <template #default="{ row }">
            <el-tag :type="accountStatusTagType(row.status)" size="small" effect="light" round>
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="verifiedStatus" label="实名" width="92">
          <template #default="{ row }">
            <el-tag :type="verifiedTagType(row.verifiedStatus)" size="small" effect="light" round>
              {{ verifiedLabel(row.verifiedStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" prop="profileAuditStatus" label="资料审核" width="100">
          <template #default="{ row }">
            <el-tag
              :type="profileAuditTagType(row.profileAuditStatus)"
              size="small"
              effect="light"
              round
            >
              {{ profileAuditLabel(row.profileAuditStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" label="来源" width="96">
          <template #default="{ row }">
            <el-tag
              v-if="row.isAdminCreated === true"
              type="warning"
              size="small"
              effect="light"
              round
            >
              后管
            </el-tag>
            <el-tag v-else-if="row.isAdminCreated === false" type="info" size="small" effect="light" round>
              用户端
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" label="微信绑定" width="100">
          <template #default="{ row }">
            <el-tag :type="wechatBindTagType(row)" size="small" effect="light" round>
              {{ wechatBindLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" label="接单状态" width="100">
          <template #default="{ row }">
            <el-tag :type="orderEnabledTagType(row.orderEnabled)" size="small" effect="light" round>
              {{ orderEnabledLabel(row.orderEnabled ?? undefined) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" label="平台与模特" width="108">
          <template #default="{ row }">
            <el-tag
              :type="contractSignedTagType(row.modelContractSignedAt)"
              size="small"
              effect="light"
              round
            >
              {{ contractSignedLabel(row.modelContractSignedAt) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="listKind === 'merchants'" label="合同签署" width="92">
          <template #default="{ row }">
            <el-tag
              :type="contractSignedTagType(row.merchantContractSignedAt ?? null)"
              size="small"
              effect="light"
              round
            >
              {{ contractSignedLabel(row.merchantContractSignedAt ?? null) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="listKind === 'brokers'" label="经纪人类型" width="108">
          <template #default="{ row }">
            <el-tag
              v-if="row.isProfessional === true"
              type="success"
              size="small"
              effect="light"
              round
            >
              专业
            </el-tag>
            <el-tag
              v-else-if="row.isProfessional === false"
              type="info"
              size="small"
              effect="light"
              round
            >
              兼职
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column v-if="listKind === 'brokers'" label="合同签署" width="92">
          <template #default="{ row }">
            <el-tag
              :type="contractSignedTagType(row.brokerContractSignedAt ?? null)"
              size="small"
              effect="light"
              round
            >
              {{ contractSignedLabel(row.brokerContractSignedAt ?? null) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="listKind === 'brokers'" label="绑定商家" width="96" align="right">
          <template #default="{ row }">
            <span class="alv-amt" style="font-size: 13px">{{ row.boundMerchantCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="160">
          <template #default="{ row }">
            <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近更新" min-width="160">
          <template #default="{ row }">
            <span class="alv-time">{{ formatTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="isBrokerList" label="操作" min-width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" plain size="small" round @click="onViewBrokerDetail(row)">
              <span class="alv-detail-btn-label">
                <span class="alv-detail-btn-text">详情</span>
                <el-icon class="alv-detail-ico el-icon--right" :size="14">
                  <Right />
                </el-icon>
              </span>
            </el-button>
          </template>
        </el-table-column>
        <el-table-column v-if="isMerchantList" label="操作" min-width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" plain size="small" round @click="onViewMerchantDetail(row)">
              <span class="alv-detail-btn-label">
                <span class="alv-detail-btn-text">详情</span>
                <el-icon class="alv-detail-ico el-icon--right" :size="14">
                  <Right />
                </el-icon>
              </span>
            </el-button>
          </template>
        </el-table-column>
        <el-table-column v-if="isModelList" label="操作" min-width="212" fixed="right">
          <template #default="{ row }">
            <div class="alv-actions-wrap">
              <el-button
                v-if="row.profileAuditStatus === 1"
                type="warning"
                plain
                size="small"
                round
                @click="onViewModelDetail(row)"
              >
                审核
              </el-button>
              <el-button type="primary" plain size="small" round @click="onViewModelDetail(row)">
                <span class="alv-detail-btn-label">
                  <span class="alv-detail-btn-text">详情</span>
                  <el-icon class="alv-detail-ico el-icon--right" :size="14">
                    <Right />
                  </el-icon>
                </span>
              </el-button>
              <el-button
                v-if="row.isAdminCreated === true"
                type="primary"
                link
                size="small"
                @click="onEditModel(row)"
              >
                编辑
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="alv-pager">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="total"
          :page-size="pager.pageSize"
          :current-page="pager.page"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
      </div>
    </el-card>

    <el-dialog
      v-model="bindAgentDialogVisible"
      title="绑定代理人"
      width="480px"
      destroy-on-close
      @closed="closeBindAgentDialog"
    >
      <p v-if="bindAgentModelRow" class="bind-agent-model-hint">
        为模特「{{ displayCellName(bindAgentModelRow.nickname) }}」（{{ bindAgentModelRow.userNo }}）选择所属代理人
      </p>
      <el-select
        v-model="bindAgentDraft"
        filterable
        placeholder="请选择代理人"
        :loading="agentOptionsLoading"
        :disabled="agentOptionsLoading || agentOptions.length === 0"
        no-data-text="暂无代理人，请先在「代理人列表」中新增"
        class="bind-agent-select"
      >
        <el-option
          v-for="a in agentOptions"
          :key="a.userId"
          :label="formatAgentOptionLabel(a)"
          :value="a.userId"
        />
      </el-select>
      <template #footer>
        <el-button @click="closeBindAgentDialog">取消</el-button>
        <el-button type="primary" :loading="bindAgentSaving" @click="onConfirmBindAgent">
          确定绑定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bindBrokerDialogVisible"
      :title="bindBrokerDialogTitle"
      width="480px"
      destroy-on-close
      @closed="closeBindBrokerDialog"
    >
      <p v-if="bindBrokerMerchantRow" class="bind-agent-model-hint">
        为商家「{{ displayCellName(bindBrokerMerchantRow.nickname) }}」（{{ bindBrokerMerchantRow.userNo }}）选择绑定经纪人
      </p>
      <p v-if="bindBrokerMerchantRow?.referrerBrokerLabel" class="bind-agent-current-hint">
        当前绑定：{{ bindBrokerMerchantRow.referrerBrokerLabel }}
      </p>
      <el-select
        v-model="bindBrokerDraft"
        filterable
        clearable
        placeholder="请选择经纪人"
        :loading="brokerOptionsLoading"
        :disabled="brokerOptionsLoading"
        no-data-text="暂无经纪人，请先在「经纪人列表」中新增并完成合同签署"
        class="bind-agent-select"
      >
        <el-option
          v-for="b in brokerOptions"
          :key="b.userId"
          :label="formatBrokerOptionLabel(b)"
          :value="b.userId"
        />
      </el-select>
      <template #footer>
        <el-button @click="closeBindBrokerDialog">取消</el-button>
        <el-button
          v-if="bindBrokerMerchantRow?.referrerBrokerUserId"
          type="danger"
          plain
          :loading="bindBrokerSaving"
          @click="onUnbindMerchantBroker"
        >
          解绑
        </el-button>
        <el-button type="primary" :loading="bindBrokerSaving" @click="onConfirmBindBroker">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="模特详情" width="980px" destroy-on-close>
      <el-skeleton v-if="detailLoading" :rows="8" animated />
      <div v-else-if="detailBasicInfo" class="detail-block">
        <div v-if="detailBasicInfo.profileAuditStatus === 1" class="detail-audit-actions-bar">
          <div class="detail-audit-actions-meta">
            <span class="detail-audit-actions-title">资料审核</span>
            <el-tag type="warning" size="small">审核中</el-tag>
          </div>
          <div class="detail-audit-actions-btns">
            <el-button
              type="success"
              plain
              size="small"
              :loading="auditDecisionBusy"
              @click="onApproveModelProfileAudit"
            >
              审核通过
            </el-button>
            <el-button
              type="danger"
              plain
              size="small"
              :loading="auditDecisionBusy"
              @click="onRejectModelProfileAudit"
            >
              驳回
            </el-button>
          </div>
        </div>
        <el-alert
          v-else-if="detailBasicInfo.profileAuditStatus === 3 && detailBasicInfo.profileAuditRejectReason"
          class="detail-audit-reject-alert"
          type="error"
          :closable="false"
          :title="'驳回说明：' + detailBasicInfo.profileAuditRejectReason"
        />
        <el-tabs type="border-card" class="detail-tabs">
          <el-tab-pane label="基础信息">
            <section class="module-card">
              <div class="basic-header">
                <el-avatar :size="52" :src="detailBasicInfo.avatarUrl || undefined">
                  {{ (detailBasicInfo.nickname || "用").slice(0, 1) }}
                </el-avatar>
                <div class="basic-header-meta">
                  <div class="basic-name">{{ detailBasicInfo.name || detailBasicInfo.nickname || "未命名模特" }}</div>
                  <div class="basic-subline">
                    <span>用户ID：{{ detailBasicInfo.userNo }}</span>
                    <span>昵称：{{ detailBasicInfo.nickname || "—" }}</span>
                    <span>所属代理人：{{ formatAgentUserLine(detailBasicInfo.agentUser) }}</span>
                  </div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>账号信息</template>
                <el-descriptions-item label="手机号">{{ detailBasicInfo.phone || "—" }}</el-descriptions-item>
                <el-descriptions-item label="性别">{{ detailBasicInfo.gender || "—" }}</el-descriptions-item>
                <el-descriptions-item label="出生日期">{{ detailBasicInfo.birthDate || "—" }}</el-descriptions-item>
                <el-descriptions-item label="所在城市">{{ detailBasicInfo.city || "—" }}</el-descriptions-item>
                <el-descriptions-item label="账号来源">
                  <el-tag
                    v-if="detailBasicInfo.isAdminCreated"
                    type="warning"
                    size="small"
                    effect="light"
                    round
                  >
                    后管创建
                  </el-tag>
                  <el-tag v-else type="info" size="small" effect="light" round>用户端注册</el-tag>
                </el-descriptions-item>
              </el-descriptions>

              <el-descriptions :column="1" border size="default" class="detail-group">
                <template #title>分账归属</template>
                <el-descriptions-item label="所属代理人">
                  <div class="model-agent-row">
                    <el-select
                      v-model="modelAgentDraft"
                      clearable
                      filterable
                      placeholder="无（代理人服务费份额归平台）"
                      :loading="agentOptionsLoading"
                      :disabled="agentOptionsLoading"
                      no-data-text="暂无代理人，请先在「代理人列表」中新增"
                      class="model-agent-select"
                    >
                      <el-option
                        v-for="a in agentOptions"
                        :key="a.userId"
                        :label="formatAgentOptionLabel(a)"
                        :value="a.userId"
                      />
                    </el-select>
                    <el-button type="primary" :loading="modelAgentSaving" @click="onSaveModelAgent">
                      保存
                    </el-button>
                  </div>
                  <div v-if="detailBasicInfo.agentUser" class="model-agent-hint">
                    已绑定：{{ detailBasicInfo.agentUser.userNo }}
                    <template v-if="detailBasicInfo.agentUser.nickname || detailBasicInfo.agentUser.realName">
                      · {{ detailBasicInfo.agentUser.realName || detailBasicInfo.agentUser.nickname }}
                    </template>
                  </div>
                </el-descriptions-item>
              </el-descriptions>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>实名信息</template>
                <el-descriptions-item label="姓名">{{ detailBasicInfo.realName || "—" }}</el-descriptions-item>
                <el-descriptions-item label="身份证号">{{ detailBasicInfo.idCardNo || "—" }}</el-descriptions-item>
                <el-descriptions-item label="签发机关">{{ detailBasicInfo.idCardIssueAuthority || "—" }}</el-descriptions-item>
                <el-descriptions-item label="有效期">{{ detailBasicInfo.idCardValidDate || "—" }}</el-descriptions-item>
              </el-descriptions>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>平台–模特合同</template>
                <el-descriptions-item label="签署状态">
                  <el-tag
                    :type="contractSignedTagType(detailBasicInfo.contractSignedAt ?? null)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ contractSignedLabel(detailBasicInfo.contractSignedAt ?? null) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="签署时间">
                  {{ detailBasicInfo.contractSignedAt ? formatTime(detailBasicInfo.contractSignedAt) : "—" }}
                </el-descriptions-item>
              </el-descriptions>

              <div class="signature-photo-wrap">
                <div class="idcard-photo-title">合同手写签名（平台–模特）</div>
                <div class="signature-photo-box">
                  <el-image
                    v-if="detailBasicInfo.contractSignatureUrl"
                    :src="detailBasicInfo.contractSignatureUrl"
                    fit="contain"
                    class="signature-photo-img"
                    :preview-src-list="[detailBasicInfo.contractSignatureUrl]"
                    preview-teleported
                  />
                  <div v-else class="signature-photo-empty">未上传签名图</div>
                </div>
              </div>

              <div class="idcard-photo-wrap">
                <div class="idcard-photo-title">身份证照片</div>
                <div class="idcard-photo-grid">
                  <div class="idcard-photo-item">
                    <div class="idcard-photo-label">人像面</div>
                    <el-image
                      v-if="detailBasicInfo.idCardFrontUrl"
                      :src="detailBasicInfo.idCardFrontUrl"
                      fit="cover"
                      class="idcard-photo-img"
                      :preview-src-list="
                        [
                          detailBasicInfo.idCardFrontUrl,
                          detailBasicInfo.idCardBackUrl
                        ].filter(Boolean) as string[]
                      "
                      preview-teleported
                    />
                    <div v-else class="idcard-photo-empty">未上传</div>
                  </div>
                  <div class="idcard-photo-item">
                    <div class="idcard-photo-label">国徽面</div>
                    <el-image
                      v-if="detailBasicInfo.idCardBackUrl"
                      :src="detailBasicInfo.idCardBackUrl"
                      fit="cover"
                      class="idcard-photo-img"
                      :preview-src-list="
                        [
                          detailBasicInfo.idCardFrontUrl,
                          detailBasicInfo.idCardBackUrl
                        ].filter(Boolean) as string[]
                      "
                      preview-teleported
                    />
                    <div v-else class="idcard-photo-empty">未上传</div>
                  </div>
                </div>
              </div>

              <el-descriptions :column="1" border size="default" class="detail-group">
                <template #title>个人介绍</template>
                <el-descriptions-item label="简介">{{ detailBasicInfo.intro || "—" }}</el-descriptions-item>
              </el-descriptions>
            </section>
          </el-tab-pane>

          <el-tab-pane label="作品集">
            <section class="module-card">
              <template
                v-if="
                  (detailBasicInfo.portfolio?.folders?.length ?? 0) > 0 ||
                  (detailBasicInfo.portfolio?.photos?.length ?? 0) > 0
                "
              >
                <div class="portfolio-folder-list">
                  <div
                    v-for="folder in detailBasicInfo.portfolio?.folders ?? []"
                    :key="folder.id"
                    class="portfolio-folder-block"
                  >
                    <div class="portfolio-folder-title">
                      <el-image
                        v-if="
                          portfolioFolderCoverThumbUrl(folder, detailBasicInfo.portfolio?.photos ?? []).length > 0
                        "
                        :src="portfolioFolderCoverThumbUrl(folder, detailBasicInfo.portfolio?.photos ?? [])"
                        fit="cover"
                        class="portfolio-folder-cover-thumb"
                      />
                      <div class="portfolio-folder-title-text">
                        <span class="portfolio-folder-name">{{ folder.name }}</span>
                        <span class="portfolio-folder-count">
                          {{
                            (detailBasicInfo.portfolio?.photos ?? []).filter((p) => p.folderId === folder.id).length
                          }}
                          张
                        </span>
                      </div>
                    </div>
                    <div
                      v-if="(detailBasicInfo.portfolio?.photos ?? []).some((p) => p.folderId === folder.id)"
                      class="portfolio-photo-grid"
                    >
                      <div
                        v-for="photo in portfolioPhotosForFolderSorted(folder, detailBasicInfo.portfolio?.photos ?? [])"
                        :key="photo.id"
                        class="portfolio-photo-cell"
                      >
                        <el-image
                          :src="photo.url"
                          fit="cover"
                          class="portfolio-photo-img"
                          :preview-src-list="
                            portfolioPhotosForFolderSorted(folder, detailBasicInfo.portfolio?.photos ?? []).map(
                              (p) => p.url
                            )
                          "
                          preview-teleported
                        />
                        <div v-if="isPortfolioFolderCoverPhoto(folder, photo.id)" class="portfolio-cover-badge">
                          文件夹封面
                        </div>
                      </div>
                    </div>
                    <div v-else class="portfolio-folder-empty">该文件夹暂无照片</div>
                  </div>
                </div>
              </template>
              <el-empty v-else description="暂无作品集数据" :image-size="72">
                <template #description>
                  <p class="portfolio-empty-desc">
                    模特在小程序「我的 → 作品集」中维护；保存后此处展示文件夹与图片。
                  </p>
                </template>
              </el-empty>
            </section>
          </el-tab-pane>

          <el-tab-pane label="风格定位">
            <section class="module-card">
              <template v-if="(detailBasicInfo.stylePosition?.photos?.length ?? 0) > 0">
                <div class="style-position-head">
                  <span class="style-position-title">风格定位图片</span>
                  <span class="style-position-count">
                    {{ detailBasicInfo.stylePosition?.photos?.length ?? 0 }} 张
                  </span>
                </div>
                <div class="style-position-grid">
                  <div
                    v-for="photo in detailBasicInfo.stylePosition?.photos ?? []"
                    :key="photo.id"
                    class="style-position-cell"
                  >
                    <el-image
                      :src="photo.url"
                      fit="cover"
                      class="style-position-img"
                      :preview-src-list="(detailBasicInfo.stylePosition?.photos ?? []).map((p) => p.url)"
                      preview-teleported
                    />
                  </div>
                </div>
              </template>
              <el-empty v-else description="暂无风格定位图片" :image-size="72">
                <template #description>
                  <p class="portfolio-empty-desc">
                    模特在小程序「我的 → 风格定位」中维护；保存后此处展示图片。
                  </p>
                </template>
              </el-empty>
            </section>
          </el-tab-pane>

          <el-tab-pane label="荣誉">
            <section class="module-card">
              <template v-if="(detailBasicInfo.honors?.length ?? 0) > 0">
                <div class="style-position-head">
                  <span class="style-position-title">个人荣誉</span>
                  <span class="style-position-count">
                    {{ detailBasicInfo.honors?.length ?? 0 }} 项
                  </span>
                </div>
                <div class="honor-list">
                  <div
                    v-for="honor in detailBasicInfo.honors ?? []"
                    :key="honor.id"
                    class="honor-item"
                  >
                    <el-image
                      v-if="honor.imageUrl"
                      :src="honor.imageUrl"
                      fit="cover"
                      class="honor-thumb"
                      :preview-src-list="(detailBasicInfo.honors ?? []).map((h) => h.imageUrl).filter(Boolean)"
                      preview-teleported
                    />
                    <div v-else class="honor-thumb honor-thumb--empty">奖</div>
                    <div class="honor-meta">
                      <div class="honor-title">{{ honor.title }}</div>
                      <div class="honor-sub">{{ honor.imageUrl ? "已上传荣誉图片" : "未上传图片" }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <el-empty v-else description="暂无个人荣誉" :image-size="72">
                <template #description>
                  <p class="portfolio-empty-desc">
                    模特在小程序「我的 → 荣誉展示」中维护；保存后此处只读展示。
                  </p>
                </template>
              </el-empty>
            </section>
          </el-tab-pane>

          <el-tab-pane label="服务信息">
            <section class="module-card">
              <div class="module-title">服务价格</div>
              <el-descriptions :column="3" border size="default" class="detail-group">
                <el-descriptions-item label="按小时">
                  {{ detailBasicInfo.price.hourly != null ? `${detailBasicInfo.price.hourly} 元` : "—" }}
                </el-descriptions-item>
                <el-descriptions-item label="半天">
                  {{ detailBasicInfo.price.halfDay != null ? `${detailBasicInfo.price.halfDay} 元` : "—" }}
                </el-descriptions-item>
                <el-descriptions-item label="全天">
                  {{ detailBasicInfo.price.fullDay != null ? `${detailBasicInfo.price.fullDay} 元` : "—" }}
                </el-descriptions-item>
              </el-descriptions>

              <el-descriptions :column="3" border size="default" class="detail-group">
                <template #title>接单设置</template>
                <el-descriptions-item label="接单状态">
                  <el-tag :type="orderEnabledTagType(detailBasicInfo.orderSettings?.orderEnabled)" size="small">
                    {{ orderEnabledLabel(detailBasicInfo.orderSettings?.orderEnabled) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="仅接本地订单">
                  {{ yesNoLabel(detailBasicInfo.orderSettings?.onlyLocal) }}
                </el-descriptions-item>
                <el-descriptions-item label="仅限女性客户">
                  {{ yesNoLabel(detailBasicInfo.orderSettings?.onlyFemale) }}
                </el-descriptions-item>
              </el-descriptions>

              <div class="module-title">模特分类</div>
              <div v-if="detailBasicInfo.categories.length > 0" class="category-list">
                <el-tag
                  v-for="item in detailBasicInfo.categories"
                  :key="item.id"
                  size="small"
                  class="category-tag"
                >
                  {{ categoryTypeLabel(item.type) }} · {{ item.name }}
                </el-tag>
              </div>
              <el-empty v-else description="暂无分类数据" :image-size="68" />
            </section>
          </el-tab-pane>

          <el-tab-pane label="模卡">
            <section class="module-card">
              <el-descriptions :column="4" border size="default" class="detail-group">
                <template #title>身材数据</template>
                <el-descriptions-item label="身高">{{ detailBasicInfo.card.measurements.height ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="体重">{{ detailBasicInfo.card.measurements.weight ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="胸围">{{ detailBasicInfo.card.measurements.bust ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="腰围">{{ detailBasicInfo.card.measurements.waist ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="臀围">{{ detailBasicInfo.card.measurements.hip ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="肩宽">{{ detailBasicInfo.card.measurements.shoulder ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="臂展">{{ detailBasicInfo.card.measurements.armSpan ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="腿长">{{ detailBasicInfo.card.measurements.legLength ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="鞋码">{{ detailBasicInfo.card.measurements.shoeSize ?? "—" }}</el-descriptions-item>
                <el-descriptions-item label="发色">{{ detailBasicInfo.card.hairColor || "—" }}</el-descriptions-item>
                <el-descriptions-item label="肤色">{{ detailBasicInfo.card.skinColor || "—" }}</el-descriptions-item>
              </el-descriptions>

              <div class="card-photo-wrap">
                <div class="card-photo-title">模卡照片（{{ detailBasicInfo.card.photoAngles.length }}）</div>
                <div v-if="detailBasicInfo.card.photoAngles.length > 0" class="card-photo-grid">
                  <div
                    v-for="(item, idx) in detailBasicInfo.card.photoAngles"
                    :key="`${item.key || 'photo'}-${idx}`"
                    class="card-photo-item"
                  >
                    <el-image
                      v-if="item.url"
                      :src="item.url"
                      fit="cover"
                      class="card-photo-img"
                      :preview-src-list="detailBasicInfo.card.photoAngles.map((p) => p.url).filter(Boolean) as string[]"
                      preview-teleported
                    />
                    <div v-else class="card-photo-empty">无图</div>
                    <div class="card-photo-label">{{ item.label || item.key || "未命名角度" }}</div>
                  </div>
                </div>
                <el-empty v-else description="暂无模卡照片" :image-size="68" />
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="档期">
            <section class="module-card">
              <div class="schedule-legend">
                <span class="legend-item"><i class="legend-dot sched-available"></i>可接单</span>
                <span class="legend-item"><i class="legend-dot sched-full"></i>已约满</span>
                <span class="legend-item"><i class="legend-dot sched-rest"></i>休息</span>
              </div>
              <div class="schedule-grid">
                <div
                  v-for="entry in scheduleEntries(detailBasicInfo.schedule?.scheduleMap)"
                  :key="entry.dateKey"
                  class="schedule-item"
                >
                  <div class="schedule-date">{{ entry.dateKey }}</div>
                  <div class="schedule-status" :class="scheduleStatusClass(entry.status)">
                    {{ scheduleStatusLabel(entry.status) }}
                  </div>
                </div>
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="收入统计">
            <section class="module-card">
              <AdminUserFinanceStatsPanel
                kind="model"
                :loading="modelIncomeStatsLoading"
                :model="modelIncomeStats"
              />
            </section>
          </el-tab-pane>

          <el-tab-pane label="订单">
            <section class="module-card merchant-orders-pane">
              <el-table
                v-loading="modelOrdersLoading"
                class="alv-table"
                :data="modelOrdersList"
                empty-text="暂无订单"
                row-key="orderId"
                size="small"
              >
                <el-table-column label="订单" width="88" align="center">
                  <template #default="{ row }">
                    <span class="alv-id-badge">{{ row.orderId }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="订单号" min-width="168" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="alv-order-block">
                      <span class="alv-order-no">{{ row.orderNo }}</span>
                      <span v-if="row.bookingDate" class="alv-order-sub">档期 {{ row.bookingDate }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="商家" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="alv-party">
                      <span
                        class="alv-party-dot"
                        :style="{
                          background: `linear-gradient(145deg, hsl(${partyHue(row.merchantUserNo || 'm')}, 72%, 88%), hsl(${partyHue(row.merchantNickname || '')}, 62%, 78%))`,
                          color: `hsl(${partyHue(row.merchantUserNo || 'm')}, 42%, 28%)`
                        }"
                      >
                        {{ partyInitial(row.merchantNickname) }}
                      </span>
                      <span class="alv-party-name">{{ displayCellName(row.merchantNickname) }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="应付" width="108" align="right">
                  <template #default="{ row }">
                    <span class="alv-amt">
                      <span class="alv-amt-cny">¥</span>{{ formatOrderAmt(row.payableAmount) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="支付" width="92">
                  <template #default="{ row }">
                    <el-tag :type="merchantPaymentTagType(row.paymentStatus)" size="small" effect="light" round>
                      {{ merchantPaymentLabel(row.paymentStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="履约" min-width="100">
                  <template #default="{ row }">
                    <el-tag :type="merchantOrderStatusTagType(row.orderStatus)" size="small" effect="light" round>
                      {{ merchantOrderStatusLabel(row.orderStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="分账" width="88" align="center">
                  <template #default="{ row }">
                    <template v-if="merchantSplitStatusCell(row) === '-'">
                      <span class="alv-split-dash">—</span>
                    </template>
                    <el-tag v-else :type="merchantSplitStatusTagType(row)" size="small" effect="light" round>
                      {{ merchantSplitStatusCell(row) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创建时间" min-width="148">
                  <template #default="{ row }">
                    <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="" width="108" align="right" fixed="right">
                  <template #default="{ row }">
                    <router-link class="alv-detail-link" :to="`/orders/${row.orderId}`">
                      <el-button type="primary" plain size="small" round>详情</el-button>
                    </router-link>
                  </template>
                </el-table-column>
              </el-table>
              <div class="alv-pager merchant-orders-pager">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes"
                  :total="modelOrdersTotal"
                  :page-size="modelOrderPager.pageSize"
                  :current-page="modelOrderPager.page"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onModelOrderPageChange"
                  @size-change="onModelOrderSizeChange"
                />
              </div>
            </section>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="merchantDetailVisible" title="商家详情" width="960px" destroy-on-close>
      <el-skeleton v-if="merchantDetailLoading" :rows="8" animated />
      <div v-else-if="merchantBasicInfo" class="detail-block">
        <el-alert
          v-if="merchantBasicInfo.profileAuditStatus === 3 && merchantBasicInfo.profileAuditRejectReason"
          class="detail-audit-reject-alert"
          type="error"
          :closable="false"
          :title="'资料驳回说明：' + merchantBasicInfo.profileAuditRejectReason"
        />
        <el-tabs type="border-card" class="detail-tabs">
          <el-tab-pane label="基本信息">
            <section class="module-card">
              <div class="basic-header">
                <el-avatar :size="52" :src="merchantBasicInfo.avatarUrl || undefined">
                  {{ (merchantBasicInfo.nickname || "用").slice(0, 1) }}
                </el-avatar>
                <div class="basic-header-meta">
                  <div class="basic-name">{{ merchantBasicInfo.nickname || "未命名商家" }}</div>
                  <div class="basic-subline">
                    <span>用户编号：{{ merchantBasicInfo.userNo }}</span>
                    <span>用户 ID：{{ merchantBasicInfo.userId }}</span>
                  </div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>平台–商家合同</template>
                <el-descriptions-item label="签署状态">
                  <el-tag
                    :type="contractSignedTagType(merchantBasicInfo.contractPlatformMerchantSignedAt)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ contractSignedLabel(merchantBasicInfo.contractPlatformMerchantSignedAt) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="签署时间">
                  {{
                    merchantBasicInfo.contractPlatformMerchantSignedAt
                      ? formatTime(merchantBasicInfo.contractPlatformMerchantSignedAt)
                      : "—"
                  }}
                </el-descriptions-item>
              </el-descriptions>

              <div class="signature-photo-wrap">
                <div class="idcard-photo-title">合同手写签名（平台–商家）</div>
                <div class="signature-photo-box">
                  <el-image
                    v-if="merchantBasicInfo.contractPlatformMerchantSignatureUrl"
                    :src="merchantBasicInfo.contractPlatformMerchantSignatureUrl"
                    fit="contain"
                    class="signature-photo-img"
                    :preview-src-list="[merchantBasicInfo.contractPlatformMerchantSignatureUrl]"
                    preview-teleported
                  />
                  <div v-else class="signature-photo-empty">未上传签名图</div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>账号与资料</template>
                <el-descriptions-item label="手机号">{{ merchantBasicInfo.phone || "—" }}</el-descriptions-item>
                <el-descriptions-item label="所在城市">{{ merchantBasicInfo.city || "—" }}</el-descriptions-item>
                <el-descriptions-item label="账号状态">
                  <el-tag :type="accountStatusTagType(merchantBasicInfo.status)" size="small" effect="light" round>
                    {{ statusLabel(merchantBasicInfo.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="实名认证">
                  <el-tag
                    :type="verifiedTagType(merchantBasicInfo.verifiedStatus)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ verifiedLabel(merchantBasicInfo.verifiedStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="资料审核">
                  <el-tag
                    :type="profileAuditTagType(merchantBasicInfo.profileAuditStatus)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ profileAuditLabel(merchantBasicInfo.profileAuditStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="绑定经纪人">
                  <div class="model-agent-row">
                    <el-select
                      v-model="merchantBrokerDraft"
                      clearable
                      filterable
                      placeholder="无（经纪人服务费份额归平台）"
                      :loading="brokerOptionsLoading"
                      :disabled="brokerOptionsLoading"
                      no-data-text="暂无经纪人，请先在「经纪人列表」中新增并完成合同签署"
                      class="model-agent-select"
                    >
                      <el-option
                        v-for="b in brokerOptions"
                        :key="b.userId"
                        :label="formatBrokerOptionLabel(b)"
                        :value="b.userId"
                      />
                    </el-select>
                    <el-button type="primary" :loading="merchantBrokerSaving" @click="onSaveMerchantBroker">
                      保存
                    </el-button>
                  </div>
                  <div v-if="merchantBasicInfo.referrerBroker?.userNo" class="model-agent-hint">
                    已绑定：{{ merchantBasicInfo.referrerBroker.userNo }}
                    <template
                      v-if="merchantBasicInfo.referrerBroker.nickname || merchantBasicInfo.referrerBroker.realName"
                    >
                      ·
                      {{
                        merchantBasicInfo.referrerBroker.realName ||
                        merchantBasicInfo.referrerBroker.nickname
                      }}
                    </template>
                  </div>
                </el-descriptions-item>
                <el-descriptions-item label="注册时间">{{ formatTime(merchantBasicInfo.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="最近更新">{{ formatTime(merchantBasicInfo.updatedAt) }}</el-descriptions-item>
              </el-descriptions>
            </section>
          </el-tab-pane>

          <el-tab-pane label="支出统计">
            <section class="module-card">
              <AdminUserFinanceStatsPanel
                kind="merchant"
                :loading="merchantExpenseStatsLoading"
                :merchant="merchantExpenseStats"
              />
            </section>
          </el-tab-pane>

          <el-tab-pane label="订单情况">
            <section class="module-card merchant-orders-pane">
              <el-table
                v-loading="merchantOrdersLoading"
                class="alv-table"
                :data="merchantOrdersList"
                empty-text="暂无订单"
                row-key="orderId"
                size="small"
              >
                <el-table-column label="订单" width="88" align="center">
                  <template #default="{ row }">
                    <span class="alv-id-badge">{{ row.orderId }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="订单号" min-width="168" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="alv-order-block">
                      <span class="alv-order-no">{{ row.orderNo }}</span>
                      <span v-if="row.bookingDate" class="alv-order-sub">档期 {{ row.bookingDate }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="模特" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="alv-party">
                      <span
                        class="alv-party-dot"
                        :style="{
                          background: `linear-gradient(145deg, hsl(${partyHue(row.modelUserNo || 'd')}, 72%, 90%), hsl(${partyHue(row.modelNickname || '')}, 62%, 80%))`,
                          color: `hsl(${partyHue(row.modelUserNo || 'd')}, 42%, 28%)`
                        }"
                      >
                        {{ partyInitial(row.modelNickname) }}
                      </span>
                      <span class="alv-party-name">{{ displayCellName(row.modelNickname) }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="应付" width="108" align="right">
                  <template #default="{ row }">
                    <span class="alv-amt">
                      <span class="alv-amt-cny">¥</span>{{ formatOrderAmt(row.payableAmount) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="支付" width="92">
                  <template #default="{ row }">
                    <el-tag :type="merchantPaymentTagType(row.paymentStatus)" size="small" effect="light" round>
                      {{ merchantPaymentLabel(row.paymentStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="履约" min-width="100">
                  <template #default="{ row }">
                    <el-tag :type="merchantOrderStatusTagType(row.orderStatus)" size="small" effect="light" round>
                      {{ merchantOrderStatusLabel(row.orderStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="分账" width="88" align="center">
                  <template #default="{ row }">
                    <template v-if="merchantSplitStatusCell(row) === '-'">
                      <span class="alv-split-dash">—</span>
                    </template>
                    <el-tag v-else :type="merchantSplitStatusTagType(row)" size="small" effect="light" round>
                      {{ merchantSplitStatusCell(row) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创建时间" min-width="148">
                  <template #default="{ row }">
                    <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="" width="108" align="right" fixed="right">
                  <template #default="{ row }">
                    <router-link class="alv-detail-link" :to="`/orders/${row.orderId}`">
                      <el-button type="primary" plain size="small" round>详情</el-button>
                    </router-link>
                  </template>
                </el-table-column>
              </el-table>
              <div class="alv-pager merchant-orders-pager">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes"
                  :total="merchantOrdersTotal"
                  :page-size="merchantOrderPager.pageSize"
                  :current-page="merchantOrderPager.page"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onMerchantOrderPageChange"
                  @size-change="onMerchantOrderSizeChange"
                />
              </div>
            </section>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="merchantDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="brokerDetailVisible" title="经纪人详情" width="960px" destroy-on-close>
      <el-skeleton v-if="brokerDetailLoading" :rows="8" animated />
      <div v-else-if="brokerBasicInfo" class="detail-block">
        <el-alert
          v-if="brokerBasicInfo.profileAuditStatus === 3 && brokerBasicInfo.profileAuditRejectReason"
          class="detail-audit-reject-alert"
          type="error"
          :closable="false"
          :title="'资料驳回说明：' + brokerBasicInfo.profileAuditRejectReason"
        />
        <el-tabs type="border-card" class="detail-tabs">
          <el-tab-pane label="基本信息">
            <section class="module-card">
              <div class="basic-header">
                <el-avatar :size="52" :src="brokerBasicInfo.avatarUrl || undefined">
                  {{ (brokerBasicInfo.nickname || "经").slice(0, 1) }}
                </el-avatar>
                <div class="basic-header-meta">
                  <div class="basic-name">{{ brokerBasicInfo.nickname || "未命名经纪人" }}</div>
                  <div class="basic-subline">
                    <span>用户编号：{{ brokerBasicInfo.userNo }}</span>
                    <span>用户 ID：{{ brokerBasicInfo.userId }}</span>
                    <span>绑定商家 {{ brokerBasicInfo.boundMerchantCount }} 家</span>
                  </div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>平台–经纪人合同</template>
                <el-descriptions-item label="签署状态">
                  <el-tag
                    :type="contractSignedTagType(brokerBasicInfo.contractPlatformBrokerSignedAt)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ contractSignedLabel(brokerBasicInfo.contractPlatformBrokerSignedAt) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="签署时间">
                  {{
                    brokerBasicInfo.contractPlatformBrokerSignedAt
                      ? formatTime(brokerBasicInfo.contractPlatformBrokerSignedAt)
                      : "—"
                  }}
                </el-descriptions-item>
              </el-descriptions>

              <div class="signature-photo-wrap">
                <div class="idcard-photo-title">合同手写签名（平台–经纪人）</div>
                <div class="signature-photo-box">
                  <el-image
                    v-if="brokerBasicInfo.contractPlatformBrokerSignatureUrl"
                    :src="brokerBasicInfo.contractPlatformBrokerSignatureUrl"
                    fit="contain"
                    class="signature-photo-img"
                    :preview-src-list="[brokerBasicInfo.contractPlatformBrokerSignatureUrl]"
                    preview-teleported
                  />
                  <div v-else class="signature-photo-empty">未上传签名图</div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>账号资料</template>
                <el-descriptions-item label="经纪人实名">{{ brokerBasicInfo.realName || "—" }}</el-descriptions-item>
                <el-descriptions-item label="身份证号">{{ brokerBasicInfo.idCardNo || "—" }}</el-descriptions-item>
                <el-descriptions-item label="签发机关">{{ brokerBasicInfo.idCardIssueAuthority || "—" }}</el-descriptions-item>
                <el-descriptions-item label="有效期">{{ brokerBasicInfo.idCardValidDate || "—" }}</el-descriptions-item>
                <el-descriptions-item label="经纪人类型">
                  <el-tag
                    :type="brokerBasicInfo.isProfessional ? 'success' : 'info'"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ brokerBasicInfo.isProfessional ? "专业经纪人" : "兼职经纪人" }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="手机号">{{ brokerBasicInfo.phone || "—" }}</el-descriptions-item>
                <el-descriptions-item label="账号状态">
                  <el-tag :type="accountStatusTagType(brokerBasicInfo.status)" size="small" effect="light" round>
                    {{ statusLabel(brokerBasicInfo.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="实名认证">
                  <el-tag
                    :type="verifiedTagType(brokerBasicInfo.verifiedStatus)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ verifiedLabel(brokerBasicInfo.verifiedStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="资料审核">
                  <el-tag
                    :type="profileAuditTagType(brokerBasicInfo.profileAuditStatus)"
                    size="small"
                    effect="light"
                    round
                  >
                    {{ profileAuditLabel(brokerBasicInfo.profileAuditStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="上级经纪人">
                  {{ formatReferrerBrokerLine(brokerBasicInfo.referrerBroker) }}
                </el-descriptions-item>
                <el-descriptions-item label="注册时间">{{ formatTime(brokerBasicInfo.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="最近更新">{{ formatTime(brokerBasicInfo.updatedAt) }}</el-descriptions-item>
              </el-descriptions>

              <div class="idcard-photo-wrap">
                <div class="idcard-photo-title">身份证照片</div>
                <div class="idcard-photo-grid">
                  <div class="idcard-photo-item">
                    <div class="idcard-photo-label">人像面</div>
                    <el-image
                      v-if="brokerBasicInfo.idCardFrontUrl"
                      :src="brokerBasicInfo.idCardFrontUrl"
                      fit="cover"
                      class="idcard-photo-img"
                      :preview-src-list="
                        [
                          brokerBasicInfo.idCardFrontUrl,
                          brokerBasicInfo.idCardBackUrl
                        ].filter(Boolean) as string[]
                      "
                      preview-teleported
                    />
                    <div v-else class="idcard-photo-empty">未上传</div>
                  </div>
                  <div class="idcard-photo-item">
                    <div class="idcard-photo-label">国徽面</div>
                    <el-image
                      v-if="brokerBasicInfo.idCardBackUrl"
                      :src="brokerBasicInfo.idCardBackUrl"
                      fit="cover"
                      class="idcard-photo-img"
                      :preview-src-list="
                        [
                          brokerBasicInfo.idCardFrontUrl,
                          brokerBasicInfo.idCardBackUrl
                        ].filter(Boolean) as string[]
                      "
                      preview-teleported
                    />
                    <div v-else class="idcard-photo-empty">未上传</div>
                  </div>
                </div>
              </div>

              <div v-if="brokerBasicInfo.isProfessional" class="signature-photo-wrap">
                <div class="idcard-photo-title">经纪人证</div>
                <div class="signature-photo-box">
                  <el-image
                    v-if="brokerBasicInfo.brokerLicenseUrl"
                    :src="brokerBasicInfo.brokerLicenseUrl"
                    fit="contain"
                    class="signature-photo-img"
                    :preview-src-list="[brokerBasicInfo.brokerLicenseUrl]"
                    preview-teleported
                  />
                  <div v-else class="signature-photo-empty">未上传经纪人证</div>
                </div>
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="绑定商家">
            <section class="module-card merchant-orders-pane">
              <el-table
                v-loading="brokerMerchantsLoading"
                class="alv-table"
                :data="brokerMerchantsList"
                empty-text="暂无绑定商家"
                row-key="userId"
                size="small"
              >
                <el-table-column label="编号" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="alv-mono">{{ row.userNo }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="头像" width="72">
                  <template #default="{ row }">
                    <el-avatar :size="32" :src="row.avatarUrl || undefined">
                      {{ (row.nickname || "商").slice(0, 1) }}
                    </el-avatar>
                  </template>
                </el-table-column>
                <el-table-column label="昵称" min-width="100" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ displayCellName(row.nickname) }}
                  </template>
                </el-table-column>
                <el-table-column label="手机" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="alv-mono">{{ row.phone || "—" }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="账号" width="88">
                  <template #default="{ row }">
                    <el-tag :type="accountStatusTagType(row.status)" size="small" effect="light" round>
                      {{ statusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="实名" width="88">
                  <template #default="{ row }">
                    <el-tag :type="verifiedTagType(row.verifiedStatus)" size="small" effect="light" round>
                      {{ verifiedLabel(row.verifiedStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="资料" width="92">
                  <template #default="{ row }">
                    <el-tag :type="profileAuditTagType(row.profileAuditStatus)" size="small" effect="light" round>
                      {{ profileAuditLabel(row.profileAuditStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="城市" min-width="88" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.city || "—" }}
                  </template>
                </el-table-column>
                <el-table-column label="平台合同" width="92">
                  <template #default="{ row }">
                    <el-tag
                      :type="contractSignedTagType(row.merchantContractSignedAt)"
                      size="small"
                      effect="light"
                      round
                    >
                      {{ contractSignedLabel(row.merchantContractSignedAt) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="注册时间" min-width="148">
                  <template #default="{ row }">
                    <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="alv-pager merchant-orders-pager">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes"
                  :total="brokerMerchantsTotal"
                  :page-size="brokerMerchantPager.pageSize"
                  :current-page="brokerMerchantPager.page"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onBrokerMerchantPageChange"
                  @size-change="onBrokerMerchantSizeChange"
                />
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="收入统计">
            <section class="module-card">
              <AdminUserFinanceStatsPanel
                kind="broker"
                :loading="brokerIncomeStatsLoading"
                :broker="brokerIncomeStats"
              />
            </section>
          </el-tab-pane>

        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="brokerDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <ModelCreateDialog
      v-model:visible="modelCreateVisible"
      :editing-model="modelEditingInfo"
      @created="onModelSaved"
      @updated="onModelSaved"
    />
  </div>
</template>

<style scoped>
/* 固定在右侧的操作列默认 .cell 为 overflow:hidden，会把「详情」右侧箭头裁掉 */
.alv-card :deep(.el-table .el-table__fixed-right .el-table__cell .cell) {
  overflow: visible;
}

.alv-actions-wrap {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.alv-detail-btn-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.alv-detail-btn-text {
  line-height: 1;
}

.detail-block {
  margin-top: 4px;
}

.detail-tabs {
  border-radius: 12px;
}

/* 模特详情 Tab 较多时横向滑动，避免「作品集」等标签被挤出视口 */
.detail-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.detail-tabs :deep(.el-tabs__nav-wrap) {
  overflow-x: auto;
  overflow-y: hidden;
}
.detail-tabs :deep(.el-tabs__nav-wrap)::after {
  display: none;
}
.detail-tabs :deep(.el-tabs__nav) {
  flex-wrap: nowrap;
}

.portfolio-empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.module-card {
  padding: 8px 4px 4px;
  background: #fff;
}

.module-title {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.basic-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.basic-header-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.basic-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.basic-subline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.detail-group {
  margin-bottom: 12px;
}

.detail-group:last-child {
  margin-bottom: 0;
}

.category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-tag {
  margin: 0;
}

.card-photo-wrap {
  margin-top: 12px;
}

.idcard-photo-wrap {
  margin-bottom: 12px;
}

.signature-photo-wrap {
  margin-bottom: 12px;
}

.signature-photo-box {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.signature-photo-img {
  width: 100%;
  height: 150px;
  display: block;
}

.signature-photo-empty {
  width: 100%;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
}

.idcard-photo-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.idcard-photo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.idcard-photo-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.idcard-photo-label {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.idcard-photo-img {
  width: 100%;
  height: 168px;
  display: block;
}

.idcard-photo-empty {
  width: 100%;
  height: 168px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
}

.card-photo-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.card-photo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.card-photo-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.card-photo-img {
  width: 100%;
  height: 168px;
  display: block;
}

.card-photo-empty {
  width: 100%;
  height: 168px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
}

.card-photo-label {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.schedule-legend {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.schedule-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}

.schedule-date {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.schedule-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-radius: 999px;
  min-height: 22px;
  padding: 0 8px;
}

.sched-available {
  color: #15803d;
  background: #dcfce7;
}

.sched-full {
  color: #b91c1c;
  background: #fee2e2;
}

.sched-rest {
  color: #4b5563;
  background: #e5e7eb;
}

.portfolio-folder-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.portfolio-folder-block {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-fill-color-blank);
}

.portfolio-folder-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.portfolio-folder-cover-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  flex-shrink: 0;
  overflow: hidden;
}

.portfolio-folder-title-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.portfolio-folder-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.portfolio-folder-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.portfolio-folder-empty {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  padding: 8px 0;
}

.portfolio-photo-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.portfolio-photo-cell {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.portfolio-photo-img {
  width: 100%;
  height: 120px;
  display: block;
}

.portfolio-cover-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(47, 107, 255, 0.92);
}

.style-position-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.style-position-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.style-position-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.style-position-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.style-position-cell {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.style-position-img {
  width: 100%;
  height: 150px;
  display: block;
}

.honor-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.honor-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.honor-thumb {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  flex-shrink: 0;
  overflow: hidden;
}

.honor-thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.honor-meta {
  min-width: 0;
}

.honor-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.45;
}

.honor-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-audit-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 14px;
  margin-bottom: 14px;
  border-radius: 10px;
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}

.detail-audit-actions-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-audit-actions-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.model-agent-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.model-agent-select {
  min-width: 280px;
  max-width: 100%;
}

.model-agent-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.alv-agent-label {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.alv-broker-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.alv-muted {
  color: var(--el-text-color-placeholder);
}

.bind-agent-model-hint {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.bind-agent-current-hint {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.bind-agent-select {
  width: 100%;
}

.detail-audit-actions-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-audit-reject-alert {
  margin-bottom: 14px;
}
</style>
