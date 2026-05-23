<script setup lang="ts">
import * as echarts from "echarts";
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowRight, Briefcase, Connection, List, Money, Shop, UserFilled } from "@element-plus/icons-vue";

import { fetchAdminDashboardStats, type AdminDashboardDailyOrderPoint } from "@/api/admin";

const router = useRouter();

const loading = ref(true);
const stats = ref({
  orderCount: 0,
  orderPayableTotal: 0,
  ordersDailyLast30Days: [] as AdminDashboardDailyOrderPoint[],
  ordersByStatus: [] as Array<{ orderStatus: number; count: number }>,
  modelCount: 0,
  merchantCount: 0,
  brokerCount: 0,
  agentCount: 0
});

const ORDER_STATUS_LABELS: Record<number, string> = {
  1: "待模特确认接单",
  2: "进行中",
  3: "模特已完成",
  4: "已完成",
  9: "已取消"
};

function orderStatusLabel(status: number): string {
  return ORDER_STATUS_LABELS[status] ?? `状态${status}`;
}

const chartEl = ref<HTMLDivElement | null>(null);
const chartInst = shallowRef<echarts.ECharts | null>(null);

function formatYuan(n: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function buildChartOption(series: AdminDashboardDailyOrderPoint[]): echarts.EChartsOption {
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
        const p = arr[0] as { dataIndex?: number; value?: number } | undefined;
        const idx = typeof p?.dataIndex === "number" ? p.dataIndex : 0;
        const date = series[idx]?.date ?? "";
        const val = p?.value ?? 0;
        return `${date}<br/>订单数：<b>${val}</b>`;
      }
    },
    grid: { left: 52, right: 20, top: 28, bottom: 52 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { rotate: 36, fontSize: 11, color: "#64748b" }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisLabel: { color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0", type: "dashed" } }
    },
    series: [
      {
        name: "订单数",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(99, 102, 241, 0.32)" },
            { offset: 1, color: "rgba(99, 102, 241, 0.03)" }
          ])
        },
        lineStyle: { width: 2.5, color: "#6366f1" },
        itemStyle: { color: "#6366f1", borderWidth: 1, borderColor: "#fff" },
        data: series.map((s) => s.count)
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
  const series = stats.value.ordersDailyLast30Days;
  if (!el || series.length === 0) return;

  if (!chartInst.value) {
    chartInst.value = echarts.init(el);
    window.addEventListener("resize", resizeChart);
  }
  chartInst.value.setOption(buildChartOption(series), { notMerge: true });
}

watch(
  () => [loading.value, stats.value.ordersDailyLast30Days] as const,
  async ([ld]) => {
    if (ld) return;
    await syncChart();
  },
  { deep: true }
);

onMounted(async () => {
  loading.value = true;
  try {
    const data = await fetchAdminDashboardStats();
    stats.value = {
      orderCount: data.orderCount,
      orderPayableTotal: data.orderPayableTotal,
      ordersDailyLast30Days: data.ordersDailyLast30Days,
      ordersByStatus: data.ordersByStatus,
      modelCount: data.modelCount,
      merchantCount: data.merchantCount,
      brokerCount: data.brokerCount,
      agentCount: data.agentCount
    };
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载统计失败");
  } finally {
    loading.value = false;
    await syncChart();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeChart);
  chartInst.value?.dispose();
  chartInst.value = null;
});

function go(path: string): void {
  void router.push(path);
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">工作台</h2>

    <div v-loading="loading" class="stats-wrap">
      <div class="stats-row stats-row--orders">
        <button type="button" class="stat-card stat-orders" @click="go('/orders')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><List /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.orderCount }}</span>
            <span class="stat-label">订单总数（全表）</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>

        <button type="button" class="stat-card stat-order-sum" @click="go('/orders')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><Money /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value stat-value--money">{{ formatYuan(stats.orderPayableTotal) }}</span>
            <span class="stat-label">订单应付总额（元）</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>
      </div>

      <div v-if="stats.ordersByStatus.length > 0" class="order-status-panel">
        <div class="order-status-head">
          <span class="order-status-title">按履约状态</span>
          <span class="order-status-hint">与订单列表「履约」列一致；点击跳转订单管理</span>
        </div>
        <div class="order-status-grid">
          <button
            v-for="item in stats.ordersByStatus"
            :key="item.orderStatus"
            type="button"
            class="order-status-chip"
            @click="go('/orders')"
          >
            <span class="order-status-chip-val">{{ item.count }}</span>
            <span class="order-status-chip-label">{{ orderStatusLabel(item.orderStatus) }}</span>
          </button>
        </div>
      </div>

      <div class="stats-row stats-row--users">
        <button type="button" class="stat-card stat-models" @click="go('/models')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><UserFilled /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.modelCount }}</span>
            <span class="stat-label">模特</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>

        <button type="button" class="stat-card stat-merchants" @click="go('/merchants')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><Shop /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.merchantCount }}</span>
            <span class="stat-label">商家</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>

        <button type="button" class="stat-card stat-brokers" @click="go('/broker-users')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><Connection /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.brokerCount }}</span>
            <span class="stat-label">经纪人</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>
        <button type="button" class="stat-card stat-agents" @click="go('/agents')">
          <div class="stat-icon-wrap">
            <el-icon class="stat-icon"><Briefcase /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ stats.agentCount }}</span>
            <span class="stat-label">代理人</span>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </button>
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <span class="chart-title">近30天订单趋势</span>
          <span class="chart-hint">按创建日汇总（与服务端日期一致）</span>
        </div>
        <div ref="chartEl" class="chart-el" role="img" aria-label="近30天每日订单数量折线图" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.page-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stats-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
}

.stats-row {
  display: grid;
  gap: 14px;
}

.stats-row--orders {
  grid-template-columns: repeat(2, 1fr);
}

.order-status-panel {
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.order-status-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 14px;
  margin-bottom: 12px;
}

.order-status-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.order-status-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.order-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
}

.order-status-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.95);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
  font: inherit;
  color: inherit;
}

.order-status-chip:hover {
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 8px 22px -10px rgba(79, 70, 229, 0.25);
  transform: translateY(-1px);
}

.order-status-chip-val {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
  line-height: 1.1;
}

.order-status-chip-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  line-height: 1.35;
}

.stats-row--users {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 1100px) {
  .stats-row--users {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .stats-row--users {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stats-row--orders {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
  font: inherit;
  color: inherit;
}

.stat-card:hover {
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 10px 28px -12px rgba(79, 70, 229, 0.28);
  transform: translateY(-2px);
}

.stat-card:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.55);
  outline-offset: 2px;
}

.stat-icon-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-orders .stat-icon-wrap {
  background: rgba(251, 146, 60, 0.14);
  color: #ea580c;
}

.stat-order-sum .stat-icon-wrap {
  background: rgba(234, 179, 8, 0.16);
  color: #ca8a04;
}

.stat-models .stat-icon-wrap {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.stat-merchants .stat-icon-wrap {
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
}

.stat-brokers .stat-icon-wrap {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.stat-agents .stat-icon-wrap {
  background: rgba(168, 85, 247, 0.12);
  color: #7c3aed;
}

.stat-icon {
  font-size: 24px;
}

.stat-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-value--money {
  font-size: 22px;
  letter-spacing: -0.01em;
}

.stat-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.stat-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: #cbd5e1;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.stat-card:hover .stat-arrow {
  color: #6366f1;
  transform: translateX(3px);
}

.chart-card {
  margin-top: 4px;
  padding: 18px 18px 8px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.chart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 14px;
  margin-bottom: 8px;
}

.chart-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.chart-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.chart-el {
  width: 100%;
  height: 320px;
}
</style>
