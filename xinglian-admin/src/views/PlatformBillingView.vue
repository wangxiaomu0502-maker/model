<script setup lang="ts">
import * as echarts from "echarts";
import { ElMessage } from "element-plus";
import { Money, Right } from "@element-plus/icons-vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  watch
} from "vue";
import {
  fetchAdminPlatformBilling,
  type AdminPlatformBillingRow,
  type AdminPlatformFeeDailyPoint
} from "@/api/admin";
import { getAdminToken } from "@/composables/useAdminToken";

const loading = ref(false);
const summaryDays = ref(30);
const feeTotalYuan = ref(0);
const feeDailyLast30Days = ref<AdminPlatformFeeDailyPoint[]>([]);
const list = ref<AdminPlatformBillingRow[]>([]);
const total = ref(0);

const chartEl = ref<HTMLDivElement | null>(null);
const chartInst = shallowRef<echarts.ECharts | null>(null);

const pager = reactive({
  page: 1,
  pageSize: 20
});

const ORDER_STATUS_LABELS: Record<number, string> = {
  1: "待模特确认接单",
  2: "进行中",
  3: "模特已完成",
  4: "已完成",
  9: "已取消"
};

function orderStatusLabel(v: number): string {
  return ORDER_STATUS_LABELS[v] ?? `状态${v}`;
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

const billingListSummary = computed(() => {
  const rows = list.value;
  let feeYuan = 0;
  for (const r of rows) {
    const v = Number(r.platformFee);
    if (Number.isFinite(v)) feeYuan += v;
  }
  return { showing: rows.length, feeYuan };
});

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

function displayPartyName(n: string | null | undefined): string {
  const x = n?.trim();
  return x ? x : "—";
}

function buildChartOption(series: AdminPlatformFeeDailyPoint[]): echarts.EChartsOption {
  const labels = series.map((s) => {
    const parts = s.date.split("-");
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : s.date;
  });
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        crossStyle: { color: "#94a3b8" },
        label: { backgroundColor: "#6366f1" }
      },
      formatter: (params) => {
        const arr = Array.isArray(params) ? params : params ? [params] : [];
        const p = arr[0] as { dataIndex?: number; value?: number | string } | undefined;
        const idx = typeof p?.dataIndex === "number" ? p.dataIndex : 0;
        const date = series[idx]?.date ?? "";
        const raw = p?.value;
        const num = typeof raw === "number" ? raw : Number(raw ?? 0);
        return `${date}<br/>服务费（元）：<b>${formatYuan(Number.isFinite(num) ? num : 0)}</b>`;
      }
    },
    grid: { left: 56, right: 20, top: 20, bottom: 52 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { rotate: 36, fontSize: 11, color: "#64748b" }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#64748b",
        formatter: (v: number) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(2))
      },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } }
    },
    series: [
      {
        name: "服务费",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(99, 102, 241, 0.28)" },
            { offset: 1, color: "rgba(99, 102, 241, 0.03)" }
          ])
        },
        lineStyle: { width: 2.5, color: "#6366f1" },
        itemStyle: { color: "#6366f1", borderWidth: 1, borderColor: "#fff" },
        data: series.map((s) => s.feeYuan)
      }
    ]
  };
}

function resizeChart(): void {
  chartInst.value?.resize();
}

async function syncChart(): Promise<void> {
  await nextTick();
  const el = chartEl.value;
  const series = feeDailyLast30Days.value;
  if (!el || series.length === 0) return;

  if (!chartInst.value) {
    chartInst.value = echarts.init(el);
    window.addEventListener("resize", resizeChart);
  }
  chartInst.value.setOption(buildChartOption(series), { notMerge: true });
}

watch(
  () => [loading.value, feeDailyLast30Days.value] as const,
  async ([ld]) => {
    if (ld) return;
    await syncChart();
  },
  { deep: true }
);

async function loadAll(): Promise<void> {
  if (!getAdminToken()) {
    ElMessage.warning("请先登录后台账号");
    list.value = [];
    total.value = 0;
    feeTotalYuan.value = 0;
    feeDailyLast30Days.value = [];
    return;
  }
  loading.value = true;
  try {
    const data = await fetchAdminPlatformBilling(pager.page, pager.pageSize);
    summaryDays.value = data.days;
    feeTotalYuan.value = data.feeTotalYuan;
    feeDailyLast30Days.value = data.feeDailyLast30Days ?? [];
    list.value = data.list || [];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    list.value = [];
    total.value = 0;
    feeTotalYuan.value = 0;
    feeDailyLast30Days.value = [];
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number): void {
  pager.page = p;
  void loadAll();
}

function onSizeChange(s: number): void {
  pager.pageSize = s;
  pager.page = 1;
  void loadAll();
}

function onTokenChanged(): void {
  void loadAll();
}

onMounted(() => {
  window.addEventListener("admin-token-changed", onTokenChanged);
  void loadAll();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeChart);
  chartInst.value?.dispose();
  chartInst.value = null;
});

onUnmounted(() => {
  window.removeEventListener("admin-token-changed", onTokenChanged);
});
</script>

<template>
  <div class="alv-page">
    <h2 class="board-heading">平台看板</h2>

    <div class="chart-panel" role="region" aria-label="近30日平台收入服务费趋势">
      <div class="chart-panel-head">
        <div class="chart-head-left">
          <div class="chart-icon-wrap" aria-hidden="true">
            <el-icon class="chart-head-icon"><Money /></el-icon>
          </div>
          <div>
            <div class="chart-panel-title">近 {{ summaryDays }} 日平台收入（服务费）</div>
            <p class="chart-panel-sub">按记账日汇总（优先分账完成时间，否则为支付日期）</p>
          </div>
        </div>
        <div class="chart-head-total" title="近30日合计">
          <span class="total-label">合计</span>
          <span class="total-value">¥ {{ formatYuan(feeTotalYuan) }}</span>
        </div>
      </div>
      <p class="chart-hint">
        仅统计已支付、服务费 &gt; 0 的订单；时间窗口为最近 {{ summaryDays }} 个自然日（与后台工作台订单趋势图同一日界线）。
      </p>
      <div ref="chartEl" class="chart-el" />
    </div>

    <header class="alv-hero billing-detail-hero">
      <div class="alv-hero-text">
        <h1 class="alv-hero-title">平台收入明细</h1>
        <p class="alv-hero-sub">
          共 <strong>{{ total }}</strong> 条记账记录，当前第
          {{ pager.page }} / {{ Math.max(1, Math.ceil(total / pager.pageSize)) }} 页
        </p>
      </div>
      <div class="alv-hero-meta">
        <div class="alv-stat alv-stat--muted">
          <span class="alv-stat-label">本页条数</span>
          <span class="alv-stat-val">{{ billingListSummary.showing }}</span>
        </div>
        <div class="alv-stat alv-stat--vio">
          <span class="alv-stat-label">本页服务费</span>
          <span class="alv-stat-val">¥ {{ formatYuan(billingListSummary.feeYuan) }}</span>
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
          <el-table-column label="记账时间" min-width="168">
            <template #default="{ row }">
              <span class="alv-time">{{ formatTime(row.creditedAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单 ID" width="96" align="center">
            <template #default="{ row }">
              <span class="alv-id-badge">{{ row.orderId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单号" min-width="200">
            <template #default="{ row }">
              <div class="alv-order-block">
                <span class="alv-order-no">{{ row.orderNo }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="商家" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="alv-party">
                <span
                  class="alv-party-dot"
                  :style="{
                    background: `linear-gradient(145deg, hsl(${partyHue(`m:${row.orderNo}`)}, 72%, 90%), hsl(${partyHue(`m:${row.orderNo}`)}, 58%, 78%))`,
                    color: `hsl(${partyHue(`m:${row.orderNo}`)}, 42%, 28%)`
                  }"
                >
                  {{ partyInitial(row.merchantNickname) }}
                </span>
                <span class="alv-party-name">{{ displayPartyName(row.merchantNickname) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="模特" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="alv-party">
                <span
                  class="alv-party-dot"
                  :style="{
                    background: `linear-gradient(145deg, hsl(${partyHue(`mdl:${row.orderNo}`)}, 72%, 90%), hsl(${partyHue(`mdl:${row.orderNo}`)}, 58%, 78%))`,
                    color: `hsl(${partyHue(`mdl:${row.orderNo}`)}, 42%, 28%)`
                  }"
                >
                  {{ partyInitial(row.modelNickname) }}
                </span>
                <span class="alv-party-name">{{ displayPartyName(row.modelNickname) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="服务费（元）" width="128" align="right">
            <template #default="{ row }">
              <span class="alv-amt">
                <span class="alv-amt-cny">¥</span>{{ formatYuan(row.platformFee) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="应付（元）" width="112" align="right">
            <template #default="{ row }">
              <span class="alv-amt" style="font-weight: 600; font-size: 14px">
                <span class="alv-amt-cny">¥</span>{{ formatYuan(row.payableAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="订单状态" min-width="128">
            <template #default="{ row }">
              <el-tag
                :type="orderStatusTagType(row.orderStatus)"
                size="small"
                effect="light"
                round
              >
                {{ orderStatusLabel(row.orderStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="112" fixed="right">
            <template #default="{ row }">
              <router-link class="alv-detail-link" :to="`/orders/${row.orderId}`">
                <el-button type="primary" plain size="small" round>
                  详情 <el-icon class="alv-detail-ico"><Right /></el-icon>
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
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.billing-detail-hero {
  margin-top: 8px;
}

.chart-panel {
  padding: 18px 20px 12px;
  border-radius: 16px;
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.05) 0%, rgba(255, 255, 255, 0.98) 55%);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.chart-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.chart-head-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.chart-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.chart-head-icon {
  font-size: 24px;
}

.chart-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-panel-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}

.chart-head-total {
  text-align: right;
  flex-shrink: 0;
}

.total-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.total-value {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  font-weight: 700;
  color: #312e81;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.chart-hint {
  margin: 10px 0 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.chart-el {
  width: 100%;
  height: 300px;
}
</style>
