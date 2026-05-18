<script setup lang="ts">
import { Right, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  fetchAdminPlatformLedger,
  type AdminPlatformLedgerRow
} from "@/api/admin";
import { getAdminToken } from "@/composables/useAdminToken";

import "@/styles/admin-list-theme.css";

const loading = ref(false);
const list = ref<AdminPlatformLedgerRow[]>([]);
const total = ref(0);
const filteredTotalYuan = ref(0);
const todayYuan = ref(0);
const monthYuan = ref(0);
const allTimeYuan = ref(0);

const pager = reactive({
  page: 1,
  pageSize: 20
});

const filters = reactive({
  dateFrom: "" as string,
  dateTo: "" as string,
  keyword: "",
  settleStatus: "all" as "all" | "settled" | "pending"
});

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatYuan(n: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

const pageSummary = computed(() => {
  let feeYuan = 0;
  for (const r of list.value) {
    const v = Number(r.amountYuan);
    if (Number.isFinite(v)) feeYuan += v;
  }
  return { showing: list.value.length, feeYuan };
});

function bizTagType(row: AdminPlatformLedgerRow): "success" | "warning" {
  return row.bizType === "settled" ? "success" : "warning";
}

async function loadList(): Promise<void> {
  if (!getAdminToken()) return;
  loading.value = true;
  try {
    const data = await fetchAdminPlatformLedger({
      page: pager.page,
      pageSize: pager.pageSize,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      keyword: filters.keyword.trim() || undefined,
      settleStatus: filters.settleStatus
    });
    list.value = data.list || [];
    total.value = data.total ?? 0;
    filteredTotalYuan.value = data.filteredTotalYuan;
    todayYuan.value = data.todayYuan;
    monthYuan.value = data.monthYuan;
    allTimeYuan.value = data.allTimeYuan;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    list.value = [];
    total.value = 0;
    filteredTotalYuan.value = 0;
  } finally {
    loading.value = false;
  }
}

function onSearch(): void {
  pager.page = 1;
  void loadList();
}

function onResetFilters(): void {
  filters.dateFrom = "";
  filters.dateTo = "";
  filters.keyword = "";
  filters.settleStatus = "all";
  pager.page = 1;
  void loadList();
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
    <h2 class="board-heading">平台流水</h2>
    <p class="page-desc">
      已支付订单的平台服务费记账；记账日优先取分账完成时间，未分账则取支付时间。累计结余按记账时间升序累加。
    </p>

    <div class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">今日入账</span>
        <span class="summary-value">¥ {{ formatYuan(todayYuan) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">本月入账</span>
        <span class="summary-value">¥ {{ formatYuan(monthYuan) }}</span>
      </div>
      <div class="summary-card summary-card--accent">
        <span class="summary-label">累计入账</span>
        <span class="summary-value">¥ {{ formatYuan(allTimeYuan) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">筛选合计</span>
        <span class="summary-value">¥ {{ formatYuan(filteredTotalYuan) }}</span>
        <span class="summary-sub">{{ total }} 笔</span>
      </div>
    </div>

    <el-card class="alv-card filter-card" shadow="never">
      <el-form class="filter-form" inline @submit.prevent="onSearch">
        <el-form-item label="记账日起">
          <el-date-picker
            v-model="filters.dateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="开始日期"
            clearable
          />
        </el-form-item>
        <el-form-item label="记账日止">
          <el-date-picker
            v-model="filters.dateTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="结束日期"
            clearable
          />
        </el-form-item>
        <el-form-item label="分账状态">
          <el-select v-model="filters.settleStatus" style="width: 140px">
            <el-option label="全部" value="all" />
            <el-option label="已分账" value="settled" />
            <el-option label="待分账" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单号">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="模糊搜索"
            style="width: 200px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
          <el-button @click="onResetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <header class="alv-hero">
      <div class="alv-hero-text">
        <h1 class="alv-hero-title">流水明细</h1>
        <p class="alv-hero-sub">
          共 <strong>{{ total }}</strong> 条，第
          {{ pager.page }} / {{ Math.max(1, Math.ceil(total / pager.pageSize)) }} 页
        </p>
      </div>
      <div class="alv-hero-meta">
        <div class="alv-stat alv-stat--muted">
          <span class="alv-stat-label">本页条数</span>
          <span class="alv-stat-val">{{ pageSummary.showing }}</span>
        </div>
        <div class="alv-stat alv-stat--vio">
          <span class="alv-stat-label">本页金额</span>
          <span class="alv-stat-val">¥ {{ formatYuan(pageSummary.feeYuan) }}</span>
        </div>
      </div>
    </header>

    <el-card class="alv-card" shadow="never">
      <div class="alv-table-wrap">
        <el-table
          v-loading="loading"
          class="alv-table"
          :data="list"
          empty-text="暂无流水"
          row-key="flowNo"
          :row-class-name="() => 'alv-table-row'"
        >
          <el-table-column label="流水号" width="108" align="center">
            <template #default="{ row }">
              <span class="alv-id-badge">{{ row.flowNo }}</span>
            </template>
          </el-table-column>
          <el-table-column label="记账时间" min-width="168">
            <template #default="{ row }">
              <span class="alv-time">{{ formatTime(row.creditedAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="业务类型" min-width="148">
            <template #default="{ row }">
              <el-tag :type="bizTagType(row)" size="small" effect="light" round>
                {{ row.bizTypeLabel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="订单号" min-width="200">
            <template #default="{ row }">
              <span class="alv-order-no">{{ row.orderNo }}</span>
            </template>
          </el-table-column>
          <el-table-column label="入账（元）" width="120" align="right">
            <template #default="{ row }">
              <span class="alv-amt alv-amt--in">
                +<span class="alv-amt-cny">¥</span>{{ formatYuan(row.amountYuan) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="累计结余（元）" width="140" align="right">
            <template #default="{ row }">
              <span class="alv-amt">
                <span class="alv-amt-cny">¥</span>{{ formatYuan(row.balanceAfterYuan) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="商家" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.merchantNickname }}
            </template>
          </el-table-column>
          <el-table-column label="模特" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.modelNickname }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="112" fixed="right">
            <template #default="{ row }">
              <router-link class="alv-detail-link" :to="`/orders/${row.orderId}`">
                <el-button type="primary" plain size="small" round>
                  订单 <el-icon class="alv-detail-ico"><Right /></el-icon>
                </el-button>
              </router-link>
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
  </div>
</template>

<style scoped>
.board-heading {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.page-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.summary-card {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.summary-card--accent {
  border-color: rgba(99, 102, 241, 0.35);
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.08), rgba(255, 255, 255, 0.98));
}

.summary-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.summary-value {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #312e81;
}

.summary-sub {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.alv-amt--in {
  color: #059669;
  font-weight: 600;
}
</style>
