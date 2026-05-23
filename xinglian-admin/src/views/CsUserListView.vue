<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Service } from "@element-plus/icons-vue";

import {
  createCsUser,
  deleteCsUser,
  fetchCsUsers,
  updateCsUser,
  type CsUserRow
} from "@/api/admin";

const loading = ref(false);
const saving = ref(false);
const list = ref<CsUserRow[]>([]);
const total = ref(0);
const pager = reactive({ page: 1, pageSize: 20 });

const dialogVisible = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editingId = ref<number | null>(null);

const form = reactive({
  username: "",
  password: "",
  displayName: "",
  phone: "",
  status: 1
});

const listPageSummary = computed(() => {
  let enabled = 0;
  let disabled = 0;
  for (const row of list.value) {
    if (row.status === 1) enabled += 1;
    else disabled += 1;
  }
  return { showing: list.value.length, enabled, disabled };
});

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchCsUsers(pager.page, pager.pageSize);
    list.value = data.list;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  dialogMode.value = "create";
  editingId.value = null;
  form.username = "";
  form.password = "";
  form.displayName = "";
  form.phone = "";
  form.status = 1;
  dialogVisible.value = true;
}

function openEdit(row: CsUserRow): void {
  dialogMode.value = "edit";
  editingId.value = row.id;
  form.username = row.username;
  form.password = "";
  form.displayName = row.displayName ?? "";
  form.phone = row.phone ?? "";
  form.status = row.status;
  dialogVisible.value = true;
}

async function onSave(): Promise<void> {
  const username = form.username.trim();
  if (!username) {
    ElMessage.warning("请输入登录账号");
    return;
  }
  if (dialogMode.value === "create" && !form.password) {
    ElMessage.warning("请设置登录密码");
    return;
  }
  if (form.password && form.password.length < 6) {
    ElMessage.warning("密码至少 6 位");
    return;
  }
  const phone = form.phone.trim();
  if (!/^1\d{10}$/.test(phone)) {
    ElMessage.warning("请输入11位客服手机号");
    return;
  }

  saving.value = true;
  try {
    if (dialogMode.value === "create") {
      await createCsUser({
        username,
        password: form.password,
        displayName: form.displayName.trim() || null,
        phone,
        status: form.status
      });
      ElMessage.success("已创建客服账号");
    } else if (editingId.value != null) {
      const body: {
        username: string;
        displayName: string | null;
        phone: string;
        status: number;
        password?: string;
      } = {
        username,
        displayName: form.displayName.trim() || null,
        phone,
        status: form.status
      };
      if (form.password) body.password = form.password;
      await updateCsUser(editingId.value, body);
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

async function onDelete(row: CsUserRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除客服「${row.username}」？此操作不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await deleteCsUser(row.id);
    ElMessage.success("已删除");
    if (list.value.length === 1 && pager.page > 1) {
      pager.page -= 1;
    }
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

function onPageChange(page: number): void {
  pager.page = page;
  void loadList();
}

function onSizeChange(size: number): void {
  pager.pageSize = size;
  pager.page = 1;
  void loadList();
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="alv-page">
    <header class="alv-hero">
      <div class="alv-hero-text">
        <h1 class="alv-hero-title">客服管理</h1>
        <p class="alv-hero-sub">
          创建与管理客服账号，客服登录后仅可处理待处理订单。共
          <strong>{{ total }}</strong> 个账号
        </p>
      </div>
      <div class="alv-hero-meta">
        <div class="alv-stat alv-stat--muted">
          <span class="alv-stat-label">本页展示</span>
          <span class="alv-stat-val">{{ listPageSummary.showing }}</span>
        </div>
        <div class="alv-stat alv-stat--ok">
          <span class="alv-stat-label">本页启用</span>
          <span class="alv-stat-val">{{ listPageSummary.enabled }}</span>
        </div>
        <div v-if="listPageSummary.disabled > 0" class="alv-stat alv-stat--danger">
          <span class="alv-stat-label">本页禁用</span>
          <span class="alv-stat-val">{{ listPageSummary.disabled }}</span>
        </div>
      </div>
      <div class="cs-hero-actions">
        <el-button type="primary" round @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增客服
        </el-button>
      </div>
    </header>

    <el-card shadow="never" class="alv-card">
      <div class="alv-table-wrap">
        <el-table
          v-loading="loading"
          class="alv-table"
          :data="list"
          empty-text="暂无客服账号，点击右上角新增"
          row-key="id"
          :row-class-name="() => 'alv-table-row'"
        >
          <el-table-column prop="id" label="ID" width="80" align="center">
            <template #default="{ row }">
              <span class="alv-id-badge">{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="username" label="登录账号" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="alv-mono">{{ row.username }}</span>
            </template>
          </el-table-column>
          <el-table-column label="显示名称" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.displayName?.trim() || "—" }}
            </template>
          </el-table-column>
          <el-table-column label="手机号" width="130">
            <template #default="{ row }">
              <span class="alv-mono">{{ row.phone?.trim() || "—" }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="96">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small" effect="light" round>
                {{ row.status === 1 ? "启用" : "禁用" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="168">
            <template #default="{ row }">
              <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="alv-pager">
          <el-pagination
            v-model:current-page="pager.page"
            v-model:page-size="pager.pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, prev, pager, next, sizes"
            background
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      width="480px"
      class="cs-dialog"
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="cs-dialog-header">
          <div class="cs-dialog-header-icon" aria-hidden="true">
            <el-icon :size="22"><Service /></el-icon>
          </div>
          <div class="cs-dialog-header-text">
            <h2 class="cs-dialog-title">
              {{ dialogMode === "create" ? "新增客服" : "编辑客服" }}
            </h2>
            <p class="cs-dialog-desc">
              {{
                dialogMode === "create"
                  ? "创建后客服可使用账号登录，仅可访问待处理订单工作台"
                  : "修改显示名称、状态或重置密码；登录账号变更后需使用新账号登录"
              }}
            </p>
          </div>
        </div>
      </template>

      <el-form
        label-position="top"
        class="cs-form"
        require-asterisk-position="right"
        @submit.prevent="onSave"
      >
        <el-form-item label="登录账号" required>
          <el-input
            v-model="form.username"
            size="large"
            placeholder="客服登录用户名"
            maxlength="64"
            clearable
          />
        </el-form-item>
        <el-form-item :label="dialogMode === 'create' ? '登录密码' : '新密码'" :required="dialogMode === 'create'">
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            show-password
            :placeholder="dialogMode === 'create' ? '至少 6 位' : '不修改请留空'"
            clearable
          />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input
            v-model="form.displayName"
            size="large"
            placeholder="工作台展示用，选填"
            maxlength="64"
            clearable
          />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input
            v-model="form.phone"
            size="large"
            placeholder="11位手机号，用户端订单详情展示"
            maxlength="11"
            clearable
          />
        </el-form-item>
        <el-form-item label="账号状态">
          <el-radio-group v-model="form.status" class="cs-status-radio">
            <el-radio :value="1" size="large" border>启用</el-radio>
            <el-radio :value="0" size="large" border>禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert
          v-if="dialogMode === 'create'"
          class="cs-form-hint"
          type="info"
          :closable="false"
          show-icon
        >
          手机号将展示在用户端订单详情，便于商家/模特主动联系客服。禁用后该客服将无法登录后台。
        </el-alert>
      </el-form>

      <template #footer>
        <div class="cs-dialog-footer">
          <el-button size="large" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" size="large" :loading="saving" @click="onSave">
            {{ dialogMode === "create" ? "创建账号" : "保存修改" }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cs-hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cs-form {
  padding: 4px 4px 0;
}

.cs-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.cs-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  line-height: 1.4;
}

.cs-status-radio {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.cs-status-radio :deep(.el-radio) {
  margin-right: 0;
  min-width: 120px;
}

.cs-form-hint {
  margin-top: 4px;
  border-radius: 10px;
}

.cs-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-right: 28px;
}

.cs-dialog-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: linear-gradient(145deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
  border: 1px solid var(--el-color-primary-light-7);
}

.cs-dialog-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--el-text-color-primary);
}

.cs-dialog-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.cs-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

:deep(.cs-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

:deep(.cs-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 22px 28px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.cs-dialog .el-dialog__body) {
  padding: 20px 28px 8px;
}

:deep(.cs-dialog .el-dialog__footer) {
  padding: 16px 28px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
