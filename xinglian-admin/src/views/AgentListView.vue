<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Document, Plus, Right, UploadFilled } from "@element-plus/icons-vue";
import type { UploadProps, UploadRequestOptions } from "element-plus";

import {
  CITY_CASCADER_OPTIONS,
  cascaderValueToCityText,
  cityTextToCascaderValue
} from "@/constants/province-city";
import {
  createAdminAgent,
  deleteAdminAgent,
  fetchAdminAgentBoundModels,
  fetchAdminAgentDetail,
  fetchAdminAgentIncomeLedger,
  fetchAdminAgents,
  updateAdminAgent,
  uploadAdminAgentBusinessLicense,
  type AdminAgentBoundModelRow,
  type AdminAgentFormBody,
  type AdminAgentIncomeLedgerRow,
  type AdminAgentRow
} from "@/api/admin";

const loading = ref(false);
const saving = ref(false);
const licenseUploading = ref(false);
const list = ref<AdminAgentRow[]>([]);
const total = ref(0);
const pager = reactive({ page: 1, pageSize: 20 });

const dialogVisible = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editingId = ref<number | null>(null);

const form = reactive({
  companyName: "",
  contactName: "",
  contactPhone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  cityCascader: [] as string[],
  businessLicenseUrl: "",
  status: 2
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

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailAgent = ref<AdminAgentRow | null>(null);
const detailUserId = ref<number | null>(null);

const detailModelsLoading = ref(false);
const detailModelsList = ref<AdminAgentBoundModelRow[]>([]);
const detailModelsTotal = ref(0);
const detailModelPager = reactive({ page: 1, pageSize: 10 });

const detailLedgerLoading = ref(false);
const detailLedgerList = ref<AdminAgentIncomeLedgerRow[]>([]);
const detailLedgerTotal = ref(0);
const detailLedgerPager = reactive({ page: 1, pageSize: 10 });
const detailWallet = ref({
  availableYuan: 0,
  frozenYuan: 0,
  ledgerTableReady: false,
  allTimeIncomeYuan: 0
});

function statusLabel(s: number): string {
  return STATUS_LABELS[s] ?? `状态${s}`;
}

function statusTagType(s: number): "success" | "warning" | "danger" | "info" {
  if (s === 1) return "success";
  if (s === 2) return "danger";
  if (s === 3) return "warning";
  if (s === 4) return "info";
  return "info";
}

function displayCellName(n: string | null | undefined): string {
  const x = n?.trim();
  return x ? x : "—";
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

function contractSignedLabel(signedAt: string | null): string {
  return signedAt ? "已签署" : "未签署";
}

function contractSignedTagType(signedAt: string | null): "success" | "info" {
  return signedAt ? "success" : "info";
}

function formatYuan(n: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function clearBusinessLicense(): void {
  form.businessLicenseUrl = "";
}

function resetForm(): void {
  form.companyName = "";
  form.contactName = "";
  form.contactPhone = "";
  form.emergencyContactName = "";
  form.emergencyContactPhone = "";
  form.cityCascader = [];
  form.businessLicenseUrl = "";
  form.status = 2;
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchAdminAgents(pager.page, pager.pageSize);
    list.value = data.list;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  dialogMode.value = "create";
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminAgentRow): void {
  dialogMode.value = "edit";
  editingId.value = row.userId;
  form.companyName = row.companyName || row.nickname || "";
  form.contactName = row.contactName || row.realName || "";
  form.contactPhone = row.contactPhone || row.phone || "";
  form.emergencyContactName = row.emergencyContactName || "";
  form.emergencyContactPhone = row.emergencyContactPhone || "";
  form.cityCascader = cityTextToCascaderValue(row.city || "");
  form.businessLicenseUrl = row.businessLicenseUrl || "";
  form.status = row.status === 2 ? 2 : 1;
  dialogVisible.value = true;
}

function validateForm(): string {
  if (!form.companyName.trim()) return "请填写公司名称";
  if (!form.contactName.trim()) return "请填写联系人";
  if (!/^1\d{10}$/.test(String(form.contactPhone).trim())) return "请填写正确的联系人电话";
  const ecPhone = String(form.emergencyContactPhone).trim();
  if (ecPhone && !/^1\d{10}$/.test(ecPhone)) return "紧急联系人电话格式不正确";
  const city = cascaderValueToCityText(form.cityCascader);
  if (!city) return "请选择所在城市（省 / 市）";
  if (!form.businessLicenseUrl.trim()) return "请上传营业执照";
  return "";
}

function buildBody(): AdminAgentFormBody {
  return {
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    emergencyContactName: form.emergencyContactName.trim() || null,
    emergencyContactPhone: form.emergencyContactPhone.trim() || null,
    city: cascaderValueToCityText(form.cityCascader),
    businessLicenseUrl: form.businessLicenseUrl.trim(),
    status: form.status
  };
}

const handleLicenseUpload: UploadProps["httpRequest"] = async (options: UploadRequestOptions) => {
  const raw = options.file;
  if (!raw) {
    options.onError?.(new Error("未选择文件") as never);
    return;
  }
  licenseUploading.value = true;
  try {
    const url = await uploadAdminAgentBusinessLicense(raw as File);
    form.businessLicenseUrl = url;
    options.onSuccess?.({ url });
    ElMessage.success("营业执照已上传");
  } catch (e) {
    const err = e instanceof Error ? e : new Error("上传失败");
    options.onError?.(err as never);
    ElMessage.error(err.message);
  } finally {
    licenseUploading.value = false;
  }
};

async function onSave(): Promise<void> {
  const err = validateForm();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  saving.value = true;
  try {
    const body = buildBody();
    if (dialogMode.value === "create") {
      await createAdminAgent(body);
      ElMessage.success("已创建代理人");
    } else if (editingId.value != null) {
      await updateAdminAgent(editingId.value, body);
      ElMessage.success("已保存");
    }
    dialogVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: AdminAgentRow): Promise<void> {
  const label = row.companyName || row.nickname || row.userNo;
  const bound = row.boundModelCount ?? 0;
  try {
    if (bound > 0) {
      await ElMessageBox.confirm(
        `代理人「${label}」下仍有 ${bound} 名模特。删除后将解除这些模特的代理人归属，并软删除该账号。确定继续？`,
        "删除代理人",
        { type: "warning", confirmButtonText: "解除并删除", cancelButtonText: "取消" }
      );
      await deleteAdminAgent(row.userId, true);
    } else {
      await ElMessageBox.confirm(`确定删除代理人「${label}」？此操作不可恢复。`, "删除代理人", {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消"
      });
      await deleteAdminAgent(row.userId, false);
    }
    ElMessage.success("已删除");
    await loadList();
  } catch (e) {
    if (e === "cancel" || (e as { message?: string })?.message === "cancel") return;
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
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
  pager.page = 1;
  void loadList();
}

async function loadDetailModelsPage(): Promise<void> {
  const uid = detailUserId.value;
  if (!uid) return;
  detailModelsLoading.value = true;
  try {
    const data = await fetchAdminAgentBoundModels(
      uid,
      detailModelPager.page,
      detailModelPager.pageSize
    );
    detailModelsList.value = data.list || [];
    detailModelsTotal.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "模特列表加载失败");
    detailModelsList.value = [];
    detailModelsTotal.value = 0;
  } finally {
    detailModelsLoading.value = false;
  }
}

async function loadDetailLedgerPage(): Promise<void> {
  const uid = detailUserId.value;
  if (!uid) return;
  detailLedgerLoading.value = true;
  try {
    const data = await fetchAdminAgentIncomeLedger(
      uid,
      detailLedgerPager.page,
      detailLedgerPager.pageSize
    );
    detailLedgerList.value = data.list || [];
    detailLedgerTotal.value = data.total ?? 0;
    detailWallet.value = data.wallet ?? {
      availableYuan: 0,
      frozenYuan: 0,
      ledgerTableReady: false,
      allTimeIncomeYuan: 0
    };
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "收入明细加载失败");
    detailLedgerList.value = [];
    detailLedgerTotal.value = 0;
  } finally {
    detailLedgerLoading.value = false;
  }
}

async function onViewDetail(row: AdminAgentRow): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detailAgent.value = null;
  detailUserId.value = row.userId;
  detailModelPager.page = 1;
  detailLedgerPager.page = 1;
  detailModelsList.value = [];
  detailModelsTotal.value = 0;
  detailLedgerList.value = [];
  detailLedgerTotal.value = 0;
  detailWallet.value = {
    availableYuan: 0,
    frozenYuan: 0,
    ledgerTableReady: false,
    allTimeIncomeYuan: 0
  };
  try {
    const [info, models, ledger] = await Promise.all([
      fetchAdminAgentDetail(row.userId),
      fetchAdminAgentBoundModels(row.userId, detailModelPager.page, detailModelPager.pageSize),
      fetchAdminAgentIncomeLedger(row.userId, detailLedgerPager.page, detailLedgerPager.pageSize)
    ]);
    detailAgent.value = info;
    detailModelsList.value = models.list || [];
    detailModelsTotal.value = models.total ?? 0;
    detailLedgerList.value = ledger.list || [];
    detailLedgerTotal.value = ledger.total ?? 0;
    detailWallet.value = ledger.wallet;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "详情加载失败");
    detailVisible.value = false;
    detailUserId.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function onDetailModelPageChange(p: number): void {
  detailModelPager.page = p;
  void loadDetailModelsPage();
}

function onDetailModelSizeChange(s: number): void {
  detailModelPager.pageSize = s;
  detailModelPager.page = 1;
  void loadDetailModelsPage();
}

function onDetailLedgerPageChange(p: number): void {
  detailLedgerPager.page = p;
  void loadDetailLedgerPage();
}

function onDetailLedgerSizeChange(s: number): void {
  detailLedgerPager.pageSize = s;
  detailLedgerPager.page = 1;
  void loadDetailLedgerPage();
}

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
        <h1 class="alv-hero-title">代理人列表</h1>
        <p class="alv-hero-sub">
          维护代理人公司与联系人资料；新建账号默认<strong>禁用</strong>，审核通过后改为正常。共
          <strong>{{ total }}</strong> 人
        </p>
      </div>
      <div class="alv-hero-actions">
        <el-button type="primary" round @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增代理人
        </el-button>
      </div>
    </header>

    <el-card class="alv-card" shadow="never">
      <el-table
        v-loading="loading"
        class="alv-table"
        :data="list"
        empty-text="暂无代理人，点击右上角新增"
        row-key="userId"
      >
        <el-table-column label="编号" prop="userNo" min-width="128">
          <template #default="{ row }">
            <span class="alv-mono">{{ row.userNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="公司名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.companyName || row.nickname || "—" }}</template>
        </el-table-column>
        <el-table-column label="联系人" min-width="96" show-overflow-tooltip>
          <template #default="{ row }">{{ row.contactName || "—" }}</template>
        </el-table-column>
        <el-table-column label="联系人电话" min-width="128">
          <template #default="{ row }">
            <span class="alv-mono">{{ row.contactPhone || row.phone || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="城市" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.city || "—" }}</template>
        </el-table-column>
        <el-table-column label="旗下模特" width="96" align="right">
          <template #default="{ row }">
            <span class="alv-amt">{{ row.boundModelCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台合同" width="92">
          <template #default="{ row }">
            <el-tag
              :type="contractSignedTagType(row.platformAgentContractSignedAt)"
              size="small"
              effect="light"
              round
            >
              {{ contractSignedLabel(row.platformAgentContractSignedAt) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="light" round>
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="160">
          <template #default="{ row }">
            <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <div class="alv-actions-wrap">
              <el-button type="primary" plain size="small" round @click="onViewDetail(row)">
                <span class="alv-detail-btn-label">
                  <span class="alv-detail-btn-text">详情</span>
                  <el-icon class="alv-detail-ico el-icon--right" :size="14">
                    <Right />
                  </el-icon>
                </span>
              </el-button>
              <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
              <el-button type="danger" link @click="onDelete(row)">删除</el-button>
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
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      width="920px"
      top="4vh"
      class="agent-dialog"
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="agent-dialog-header">
          <h2 class="agent-dialog-title">
            {{ dialogMode === "create" ? "新增代理人" : "编辑代理人" }}
          </h2>
          <p class="agent-dialog-desc">填写公司与联系人资料，上传营业执照后可保存</p>
        </div>
      </template>

      <el-form
        label-position="top"
        class="agent-form"
        require-asterisk-position="right"
        @submit.prevent="onSave"
      >
        <el-form-item label="公司名称" required>
          <el-input
            v-model="form.companyName"
            size="large"
            maxlength="100"
            placeholder="营业执照上的公司全称"
            clearable
          />
        </el-form-item>

        <el-form-item label="联系人" required>
          <el-input
            v-model="form.contactName"
            size="large"
            maxlength="50"
            placeholder="业务对接人姓名"
            clearable
          />
        </el-form-item>

        <el-form-item label="联系人电话" required>
          <el-input
            v-model="form.contactPhone"
            size="large"
            maxlength="11"
            placeholder="11 位手机号"
            clearable
          />
        </el-form-item>

        <el-form-item label="紧急联系人">
          <el-input
            v-model="form.emergencyContactName"
            size="large"
            maxlength="50"
            placeholder="选填"
            clearable
          />
        </el-form-item>

        <el-form-item label="紧急联系人电话">
          <el-input
            v-model="form.emergencyContactPhone"
            size="large"
            maxlength="11"
            placeholder="选填，11 位手机号"
            clearable
          />
        </el-form-item>

        <el-form-item label="所在城市" required>
          <el-cascader
            v-model="form.cityCascader"
            size="large"
            :options="CITY_CASCADER_OPTIONS"
            placeholder="请选择省 / 市"
            filterable
            clearable
            class="field-full"
          />
        </el-form-item>
        <el-form-item label="营业执照" required class="license-form-item">
          <el-upload
            drag
            class="license-uploader"
            :class="{ 'is-uploaded': !!form.businessLicenseUrl, 'is-uploading': licenseUploading }"
            :show-file-list="false"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            :http-request="handleLicenseUpload"
            :disabled="licenseUploading"
          >
            <div v-if="licenseUploading" class="license-drop-inner">
              <el-icon class="license-drop-icon is-loading"><UploadFilled /></el-icon>
              <p class="license-drop-title">正在上传…</p>
            </div>
            <div
              v-else-if="form.businessLicenseUrl && !isPdfUrl(form.businessLicenseUrl)"
              class="license-drop-preview"
            >
              <el-image
                :src="form.businessLicenseUrl"
                fit="contain"
                class="license-drop-img"
                :preview-src-list="[form.businessLicenseUrl]"
                preview-teleported
                @click.stop
              />
              <p class="license-drop-tip">点击或拖拽可更换文件</p>
            </div>
            <div v-else-if="form.businessLicenseUrl && isPdfUrl(form.businessLicenseUrl)" class="license-drop-inner">
              <el-icon class="license-drop-icon pdf"><Document /></el-icon>
              <p class="license-drop-title">PDF 已上传</p>
              <p class="license-drop-tip">点击或拖拽可更换文件</p>
              <el-link
                :href="form.businessLicenseUrl"
                target="_blank"
                type="primary"
                :underline="false"
                class="license-pdf-link"
                @click.stop
              >
                预览 PDF
              </el-link>
            </div>
            <div v-else class="license-drop-inner">
              <el-icon class="license-drop-icon"><UploadFilled /></el-icon>
              <p class="license-drop-title">
                将营业执照拖到此处，或<em>点击上传</em>
              </p>
              <p class="license-drop-tip">支持 JPG、PNG、WEBP、PDF，单文件不超过 10MB</p>
            </div>
          </el-upload>
          <div v-if="form.businessLicenseUrl" class="license-actions">
            <el-button type="danger" link @click="clearBusinessLicense">移除文件</el-button>
          </div>
        </el-form-item>

        <el-form-item label="账号状态">
          <el-radio-group v-model="form.status" class="status-radio">
            <el-radio :value="2" size="large" border>禁用（新建默认）</el-radio>
            <el-radio :value="1" size="large" border>正常</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-alert
          v-if="dialogMode === 'create'"
          class="form-hint-alert"
          type="info"
          :closable="false"
          show-icon
        >
          后台创建的账号使用运营占位 openid；默认禁用，确认资料无误后改为「正常」。代理人需另行绑定微信后才能在小程序登录。
        </el-alert>
      </el-form>

      <template #footer>
        <div class="agent-dialog-footer">
          <el-button size="large" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" size="large" :loading="saving" @click="onSave">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="代理人详情" width="960px" destroy-on-close>
      <el-skeleton v-if="detailLoading" :rows="8" animated />
      <div v-else-if="detailAgent" class="detail-block">
        <el-tabs type="border-card" class="detail-tabs">
          <el-tab-pane label="基本信息">
            <section class="module-card">
              <div class="basic-header">
                <el-avatar :size="52" :src="detailAgent.avatarUrl || undefined">
                  {{ (detailAgent.companyName || detailAgent.nickname || "代").slice(0, 1) }}
                </el-avatar>
                <div class="basic-header-meta">
                  <div class="basic-name">{{ detailAgent.companyName || detailAgent.nickname || "未命名" }}</div>
                  <div class="basic-subline">
                    <span>用户编号：{{ detailAgent.userNo }}</span>
                    <span>用户 ID：{{ detailAgent.userId }}</span>
                    <span>旗下模特 {{ detailAgent.boundModelCount ?? 0 }} 人</span>
                  </div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>公司与联系</template>
                <el-descriptions-item label="公司名称">
                  {{ detailAgent.companyName || detailAgent.nickname || "—" }}
                </el-descriptions-item>
                <el-descriptions-item label="联系人">
                  {{ detailAgent.contactName || detailAgent.realName || "—" }}
                </el-descriptions-item>
                <el-descriptions-item label="联系人电话">
                  <span class="alv-mono">{{ detailAgent.contactPhone || detailAgent.phone || "—" }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="所在城市">{{ detailAgent.city || "—" }}</el-descriptions-item>
                <el-descriptions-item label="紧急联系人">
                  {{ detailAgent.emergencyContactName || "—" }}
                </el-descriptions-item>
                <el-descriptions-item label="紧急联系人电话">
                  <span class="alv-mono">{{ detailAgent.emergencyContactPhone || "—" }}</span>
                </el-descriptions-item>
              </el-descriptions>

              <div class="license-photo-wrap">
                <div class="idcard-photo-title">营业执照</div>
                <div class="license-photo-box">
                  <el-image
                    v-if="detailAgent.businessLicenseUrl && !isPdfUrl(detailAgent.businessLicenseUrl)"
                    :src="detailAgent.businessLicenseUrl"
                    fit="contain"
                    class="license-photo-img"
                    :preview-src-list="[detailAgent.businessLicenseUrl]"
                    preview-teleported
                  />
                  <div
                    v-else-if="detailAgent.businessLicenseUrl && isPdfUrl(detailAgent.businessLicenseUrl)"
                    class="license-photo-pdf"
                  >
                    <el-link :href="detailAgent.businessLicenseUrl" target="_blank" type="primary">查看 PDF</el-link>
                  </div>
                  <div v-else class="license-photo-empty">未上传</div>
                </div>
              </div>

              <el-descriptions :column="2" border size="default" class="detail-group">
                <template #title>账号</template>
                <el-descriptions-item label="账号状态">
                  <el-tag :type="statusTagType(detailAgent.status)" size="small" effect="light" round>
                    {{ statusLabel(detailAgent.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="实名认证">
                  <el-tag :type="verifiedTagType(detailAgent.verifiedStatus)" size="small" effect="light" round>
                    {{ verifiedLabel(detailAgent.verifiedStatus) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="注册时间">{{ formatTime(detailAgent.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="最近更新">{{ formatTime(detailAgent.updatedAt) }}</el-descriptions-item>
              </el-descriptions>
            </section>
          </el-tab-pane>

          <el-tab-pane label="模特">
            <section class="module-card merchant-orders-pane">
              <el-table
                v-loading="detailModelsLoading"
                class="alv-table"
                :data="detailModelsList"
                empty-text="暂无绑定模特"
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
                      {{ (row.nickname || "模").slice(0, 1) }}
                    </el-avatar>
                  </template>
                </el-table-column>
                <el-table-column label="昵称" min-width="100" show-overflow-tooltip>
                  <template #default="{ row }">{{ displayCellName(row.nickname) }}</template>
                </el-table-column>
                <el-table-column label="手机" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="alv-mono">{{ row.phone || "—" }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="账号" width="88">
                  <template #default="{ row }">
                    <el-tag :type="statusTagType(row.status)" size="small" effect="light" round>
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
                  <template #default="{ row }">{{ row.city || "—" }}</template>
                </el-table-column>
                <el-table-column label="经纪合同" width="92">
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
                  :total="detailModelsTotal"
                  :page-size="detailModelPager.pageSize"
                  :current-page="detailModelPager.page"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onDetailModelPageChange"
                  @size-change="onDetailModelSizeChange"
                />
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="收入明细">
            <section class="module-card merchant-orders-pane">
              <div class="income-summary">
                <div class="income-summary-item">
                  <span class="income-summary-label">累计入账</span>
                  <span class="income-summary-value">¥ {{ formatYuan(detailWallet.allTimeIncomeYuan) }}</span>
                </div>
                <div class="income-summary-item">
                  <span class="income-summary-label">可用余额</span>
                  <span class="income-summary-value">¥ {{ formatYuan(detailWallet.availableYuan) }}</span>
                </div>
                <div class="income-summary-item">
                  <span class="income-summary-label">冻结</span>
                  <span class="income-summary-value">¥ {{ formatYuan(detailWallet.frozenYuan) }}</span>
                </div>
                <span v-if="!detailWallet.ledgerTableReady" class="income-summary-hint">账户流水表未就绪</span>
              </div>
              <el-table
                v-loading="detailLedgerLoading"
                class="alv-table"
                :data="detailLedgerList"
                empty-text="暂无收入流水"
                row-key="id"
                size="small"
              >
                <el-table-column label="时间" min-width="168">
                  <template #default="{ row }">
                    <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.bizTypeLabel || row.bizType || "—" }}</template>
                </el-table-column>
                <el-table-column label="金额（元）" width="120" align="right">
                  <template #default="{ row }">
                    <span class="alv-amt" :class="{ 'alv-amt--pos': row.amountYuan > 0 }">
                      <span class="alv-amt-cny">{{ row.amountYuan >= 0 ? "+" : "" }}</span
                      >{{ formatYuan(row.amountYuan) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="余额后" width="112" align="right">
                  <template #default="{ row }">
                    <span v-if="row.balanceAfterYuan != null" class="alv-amt">
                      <span class="alv-amt-cny">¥</span>{{ formatYuan(row.balanceAfterYuan) }}
                    </span>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <el-table-column label="订单" width="96" align="center">
                  <template #default="{ row }">
                    <router-link
                      v-if="row.orderId"
                      class="alv-detail-link"
                      :to="`/orders/${row.orderId}`"
                    >
                      <span class="alv-id-badge">{{ row.orderId }}</span>
                    </router-link>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
                <el-table-column label="订单号" min-width="168" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="alv-mono">{{ row.orderNo || "—" }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.title || "—" }}</template>
                </el-table-column>
              </el-table>
              <div class="alv-pager merchant-orders-pager">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes"
                  :total="detailLedgerTotal"
                  :page-size="detailLedgerPager.pageSize"
                  :current-page="detailLedgerPager.page"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onDetailLedgerPageChange"
                  @size-change="onDetailLedgerSizeChange"
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
  </div>
</template>

<style scoped>
.alv-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.alv-hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alv-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.agent-form {
  padding: 4px 4px 0;
}

.agent-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

.agent-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  line-height: 1.4;
}

.field-full {
  width: 100%;
}

.status-radio {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.status-radio :deep(.el-radio) {
  margin-right: 0;
  min-width: 168px;
}

.form-hint-alert {
  margin-top: 4px;
  border-radius: 10px;
}

.agent-dialog-header {
  padding-right: 28px;
}

.agent-dialog-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--el-text-color-primary);
}

.agent-dialog-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.agent-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

.license-form-item :deep(.el-form-item__content) {
  line-height: 1.4;
}

.license-uploader {
  width: 100%;
}

.license-uploader :deep(.el-upload) {
  width: 100%;
}

.license-uploader :deep(.el-upload-dragger) {
  width: 100%;
  min-height: 200px;
  padding: 28px 24px;
  border-radius: 14px;
  border: 1.5px dashed var(--el-border-color);
  background: linear-gradient(180deg, var(--el-fill-color-blank) 0%, var(--el-fill-color-light) 100%);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.license-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary-light-3);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 8px 24px rgb(64 158 255 / 8%);
}

.license-uploader.is-uploaded :deep(.el-upload-dragger) {
  border-style: solid;
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.license-uploader.is-uploading :deep(.el-upload-dragger) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.license-drop-inner,
.license-drop-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 144px;
}

.license-drop-icon {
  font-size: 52px;
  color: var(--el-color-primary);
}

.license-drop-icon.pdf {
  color: var(--el-color-warning);
}

.license-drop-icon.is-loading {
  animation: license-spin 1s linear infinite;
}

@keyframes license-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.license-drop-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.license-drop-title em {
  font-style: normal;
  color: var(--el-color-primary);
}

.license-drop-tip {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.license-drop-img {
  max-width: 100%;
  max-height: 220px;
  border-radius: 8px;
}

.license-pdf-link {
  margin-top: 4px;
  font-size: 14px;
}

.license-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

:deep(.agent-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

:deep(.agent-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 22px 28px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.agent-dialog .el-dialog__body) {
  padding: 20px 28px 8px;
  max-height: calc(88vh - 160px);
  overflow-y: auto;
}

:deep(.agent-dialog .el-dialog__footer) {
  padding: 16px 28px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}

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

.module-card {
  padding: 8px 4px 4px;
  background: #fff;
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

.license-photo-wrap {
  margin-bottom: 12px;
}

.idcard-photo-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.license-photo-box {
  min-height: 120px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}

.license-photo-img {
  max-width: 100%;
  max-height: 240px;
}

.license-photo-empty,
.license-photo-pdf {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.merchant-orders-pane {
  padding-top: 4px;
}

.merchant-orders-pager {
  margin-top: 12px;
}

.income-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px 24px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.income-summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.income-summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.income-summary-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.income-summary-hint {
  font-size: 12px;
  color: var(--el-color-warning);
}

.alv-amt--pos {
  color: var(--el-color-success);
}
</style>
