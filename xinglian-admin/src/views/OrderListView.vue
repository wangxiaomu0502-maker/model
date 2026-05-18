<script setup lang="ts">
import { Right } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { fetchAdminOrders, type AdminOrderRow } from "@/api/admin";
import { getAdminToken } from "@/composables/useAdminToken";

const loading = ref(false);
const list = ref<AdminOrderRow[]>([]);
const total = ref(0);

const pager = reactive({
  page: 1,
  pageSize: 20
});

const PAYMENT_LABELS: Record<number, string> = {
  0: "未支付",
  1: "已支付",
  2: "退款中",
  3: "已退款"
};

const ORDER_STATUS_LABELS: Record<number, string> = {
  1: "待模特确认接单",
  2: "进行中",
  3: "模特已完成",
  4: "已完成",
  9: "已取消"
};

function paymentLabel(v: number): string {
  return PAYMENT_LABELS[v] ?? `支付${v}`;
}

function orderStatusLabel(v: number): string {
  return ORDER_STATUS_LABELS[v] ?? `状态${v}`;
}

function paymentTagType(
  status: number
): "info" | "success" | "warning" | "danger" | "primary" {
  if (status === 1) return "success";
  if (status === 2) return "warning";
  if (status === 3) return "danger";
  return "info";
}

function orderStatusTagType(
  status: number
): "info" | "success" | "warning" | "danger" | "primary" {
  if (status === 1) return "warning";
  if (status === 2) return "primary";
  if (status === 3) return "info";
  if (status === 4) return "success";
  if (status === 9) return "danger";
  return "info";
}

const ORDER_COMPLETED = 4;

/** 兼容旧后端无 splitStatusLabel 字段 */
function splitStatusCell(row: AdminOrderRow): "-" | "待分账" | "已分账" {
  const fromApi = row.splitStatusLabel;
  if (fromApi === "待分账" || fromApi === "已分账" || fromApi === "-") return fromApi;
  if (row.orderStatus !== ORDER_COMPLETED) return "-";
  return row.splitCalculatedAt == null || row.splitCalculatedAt === "" ? "待分账" : "已分账";
}

function splitStatusTagType(row: AdminOrderRow): "warning" | "success" {
  return splitStatusCell(row) === "已分账" ? "success" : "warning";
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatAmt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(2);
}

function displayName(nickname: string | null | undefined): string {
  const n = nickname?.trim();
  return n ? n : "—";
}

function partyInitial(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return "?";
  return n.slice(0, 1);
}

function partyHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 200 + (h % 140);
}

const pageSummary = computed(() => {
  const rows = list.value;
  let completed = 0;
  let pendingSplit = 0;
  let inProgress = 0;
  for (const r of rows) {
    if (r.orderStatus === ORDER_COMPLETED) completed += 1;
    if (splitStatusCell(r) === "待分账") pendingSplit += 1;
    if (r.orderStatus === 2 || r.orderStatus === 3) inProgress += 1;
  }
  return { completed, pendingSplit, inProgress, showing: rows.length };
});

async function loadList(): Promise<void> {
  if (!getAdminToken()) {
    ElMessage.warning("请先登录后台账号");
    list.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const data = await fetchAdminOrders(pager.page, pager.pageSize);
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
        <h1 class="alv-hero-title">订单管理</h1>
        <p class="alv-hero-sub">
          全平台订单履约与分账进度；共 <strong>{{ total }}</strong> 条，当前第
          {{ pager.page }} / {{ Math.max(1, Math.ceil(total / pager.pageSize)) }} 页
        </p>
      </div>
      <div class="alv-hero-meta">
        <div class="alv-stat alv-stat--muted">
          <span class="alv-stat-label">本页展示</span>
          <span class="alv-stat-val">{{ pageSummary.showing }}</span>
        </div>
        <div class="alv-stat alv-stat--vio">
          <span class="alv-stat-label">本页履约中</span>
          <span class="alv-stat-val">{{ pageSummary.inProgress }}</span>
        </div>
        <div class="alv-stat alv-stat--warn" v-if="pageSummary.pendingSplit > 0">
          <span class="alv-stat-label">本页待分账</span>
          <span class="alv-stat-val">{{ pageSummary.pendingSplit }}</span>
        </div>
        <div class="alv-stat alv-stat--ok">
          <span class="alv-stat-label">本页已完成</span>
          <span class="alv-stat-val">{{ pageSummary.completed }}</span>
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
          row-key="orderId"
          :row-class-name="() => 'alv-table-row'"
        >
          <el-table-column label="订单" width="96" align="center">
            <template #default="{ row }">
              <span class="alv-id-badge">{{ row.orderId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单信息" min-width="220">
            <template #default="{ row }">
              <div class="alv-order-block">
                <span class="alv-order-no">{{ row.orderNo }}</span>
                <span v-if="row.bookingDate" class="alv-order-sub">档期 {{ row.bookingDate }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="商家" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="alv-party">
                <span
                  class="alv-party-dot"
                  :style="{
                    background: `linear-gradient(145deg, hsl(${partyHue(row.merchantUserNo || 'm')}, 72%, 88%), hsl(${partyHue(row.merchantNickname || '')}, 62%, 78%))`,
                    color: `hsl(${partyHue(row.merchantUserNo || 'm')}, 42%, 28%)`
                  }"
                  >{{ partyInitial(row.merchantNickname) }}</span
                >
                <span class="alv-party-name">{{ displayName(row.merchantNickname) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="模特" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="alv-party">
                <span
                  class="alv-party-dot"
                  :style="{
                    background: `linear-gradient(145deg, hsl(${partyHue(row.modelUserNo || 'd')}, 72%, 90%), hsl(${partyHue(row.modelNickname || '')}, 62%, 80%))`,
                    color: `hsl(${partyHue(row.modelUserNo || 'd')}, 42%, 28%)`
                  }"
                  >{{ partyInitial(row.modelNickname) }}</span
                >
                <span class="alv-party-name">{{ displayName(row.modelNickname) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="应付" width="120" align="right">
            <template #default="{ row }">
              <span class="alv-amt">
                <span class="alv-amt-cny">¥</span>{{ formatAmt(row.payableAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="支付" width="104">
            <template #default="{ row }">
              <el-tag :type="paymentTagType(row.paymentStatus)" size="small" effect="light" round>
                {{ paymentLabel(row.paymentStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="履约" min-width="108">
            <template #default="{ row }">
              <el-tag :type="orderStatusTagType(row.orderStatus)" size="small" effect="light" round>
                {{ orderStatusLabel(row.orderStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分账" width="100" align="center">
            <template #default="{ row }">
              <template v-if="splitStatusCell(row) === '-'">
                <span class="alv-split-dash">—</span>
              </template>
              <el-tag v-else :type="splitStatusTagType(row)" size="small" effect="light" round>
                {{ splitStatusCell(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="158">
            <template #default="{ row }">
              <span class="alv-time">{{ formatTime(row.createdAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="120" fixed="right" align="right">
            <template #default="{ row }">
              <router-link class="alv-detail-link" :to="`/orders/${row.orderId}`">
                <el-button type="primary" plain size="small" round>
                  详情 <el-icon class="alv-detail-ico"><Right /></el-icon>
                </el-button>
              </router-link>
            </template>
          </el-table-column>
        </el-table>
      </div>
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
  </div>
</template>
