<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Key, Plus } from "@element-plus/icons-vue";

import {
  fetchModelRegistrationCodes,
  generateModelRegistrationCodes,
  type ModelRegistrationCodeRow
} from "@/api/admin";

const loading = ref(false);
const generating = ref(false);
const list = ref<ModelRegistrationCodeRow[]>([]);
const total = ref(0);
const stats = ref({ total: 0, unused: 0, used: 0 });
const pager = reactive({ page: 1, pageSize: 20 });
const statusFilter = ref<"all" | "unused" | "used">("all");

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchModelRegistrationCodes({
      page: pager.page,
      pageSize: pager.pageSize,
      status: statusFilter.value
    });
    list.value = data.list;
    total.value = data.total;
    stats.value = data.stats;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function onStatusChange(): void {
  pager.page = 1;
  void loadList();
}

async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success("授权码已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
}

async function onGenerate(): Promise<void> {
  try {
    await ElMessageBox.confirm("将批量生成 1000 个 8 位授权码（数字+字母），是否继续？", "生成授权码", {
      confirmButtonText: "生成",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  generating.value = true;
  try {
    const result = await generateModelRegistrationCodes(1000);
    ElMessage.success(`已生成 ${result.created} 个授权码`);
    pager.page = 1;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "生成失败");
  } finally {
    generating.value = false;
  }
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="page-wrap">
    <div class="page-head">
      <div class="page-head-main">
        <h1 class="page-title">授权码管理</h1>
        <p class="page-desc">模特自行注册需输入有效授权码；每个授权码仅可使用一次。</p>
      </div>
      <el-button type="primary" :loading="generating" @click="onGenerate">
        <el-icon><Plus /></el-icon>
        生成 1000 个授权码
      </el-button>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-label">总计</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-card stat-card--unused">
        <span class="stat-label">未使用</span>
        <span class="stat-value">{{ stats.unused }}</span>
      </div>
      <div class="stat-card stat-card--used">
        <span class="stat-label">已使用</span>
        <span class="stat-value">{{ stats.used }}</span>
      </div>
    </div>

    <el-card shadow="never" class="list-card">
      <div class="toolbar">
        <el-radio-group v-model="statusFilter" @change="onStatusChange">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="unused">未使用</el-radio-button>
          <el-radio-button value="used">已使用</el-radio-button>
        </el-radio-group>
      </div>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="授权码" min-width="140">
          <template #default="{ row }">
            <span class="code-text">
              <el-icon class="code-icon"><Key /></el-icon>
              {{ row.code }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.usedAt ? 'info' : 'success'" size="small">
              {{ row.usedAt ? "已使用" : "未使用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用用户 ID" width="120" prop="usedByUserId">
          <template #default="{ row }">
            {{ row.usedByUserId ?? "—" }}
          </template>
        </el-table-column>
        <el-table-column label="使用时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.usedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="copyCode(row.code)">复制</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadList"
          @size-change="
            () => {
              pager.page = 1;
              loadList();
            }
          "
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.page-desc {
  margin: 6px 0 0;
  font-size: 14px;
  color: #64748b;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 16px 18px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.stat-card--unused {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.stat-card--used {
  border-color: #e2e8f0;
  background: #f8fafc;
}

.stat-label {
  display: block;
  font-size: 13px;
  color: #64748b;
}

.stat-value {
  display: block;
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.list-card {
  border-radius: 12px;
}

.toolbar {
  margin-bottom: 16px;
}

.code-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.code-icon {
  color: #6366f1;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
