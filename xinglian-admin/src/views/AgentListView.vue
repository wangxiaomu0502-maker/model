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
  fetchAdminAgents,
  updateAdminAgent,
  uploadAdminAgentBusinessLicense,
  type AdminAgentFormBody,
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
  2: "禁用"
};

function statusLabel(s: number): string {
  return STATUS_LABELS[s] ?? `状态${s}`;
}

function statusTagType(s: number): "success" | "danger" | "info" {
  if (s === 1) return "success";
  if (s === 2) return "danger";
  return "info";
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
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="onDelete(row)">删除</el-button>
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
</style>
