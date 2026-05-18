<script setup lang="ts">
import { computed } from "vue";
import type {
  AdminBrokerIncomeStatsPayload,
  AdminMerchantExpenseStatsPayload,
  AdminModelIncomeStatsPayload
} from "@/api/admin";

const props = defineProps<{
  loading?: boolean;
  kind: "merchant" | "model" | "broker";
  merchant?: AdminMerchantExpenseStatsPayload | null;
  model?: AdminModelIncomeStatsPayload | null;
  broker?: AdminBrokerIncomeStatsPayload | null;
}>();

function formatYuan(n: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
}

function formatTrendDate(ymd: string): string {
  const p = ymd.split("-");
  return p.length >= 3 ? `${p[1]}/${p[2]}` : ymd;
}

const trendRows = computed(() => {
  if (props.kind === "merchant" && props.merchant?.stats.trend7d) {
    return props.merchant.stats.trend7d.map((r) => ({
      date: r.date,
      label: formatTrendDate(r.date),
      amount: r.expense
    }));
  }
  if (props.kind === "model" && props.model?.stats.trend7d) {
    return props.model.stats.trend7d.map((r) => ({
      date: r.date,
      label: formatTrendDate(r.date),
      amount: r.income
    }));
  }
  if (props.kind === "broker" && props.broker?.stats.trend7d) {
    return props.broker.stats.trend7d.map((r) => ({
      date: r.date,
      label: formatTrendDate(r.date),
      amount: r.income
    }));
  }
  return [];
});

const trendMax = computed(() => {
  let m = 0;
  for (const r of trendRows.value) {
    if (r.amount > m) m = r.amount;
  }
  return m > 0 ? m : 1;
});
</script>

<template>
  <section v-loading="loading" class="finance-stats">
    <template v-if="kind === 'merchant' && merchant">
      <p class="finance-hint">按已支付订单的支付时间统计应付金额（与小程序商家支出口径一致）。</p>
      <div class="finance-grid">
        <div class="finance-card">
          <span class="finance-label">今日支出</span>
          <span class="finance-value finance-value--out">¥ {{ formatYuan(merchant.stats.today.expenseYuan) }}</span>
          <span class="finance-sub">{{ merchant.stats.today.orderCount }} 笔</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本周支出</span>
          <span class="finance-value finance-value--out">¥ {{ formatYuan(merchant.stats.week.expenseYuan) }}</span>
          <span class="finance-sub">{{ merchant.stats.week.orderCount }} 笔</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本月支出</span>
          <span class="finance-value finance-value--out">¥ {{ formatYuan(merchant.stats.month.expenseYuan) }}</span>
          <span class="finance-sub">{{ merchant.stats.month.orderCount }} 笔</span>
        </div>
        <div class="finance-card finance-card--accent">
          <span class="finance-label">累计支出</span>
          <span class="finance-value">¥ {{ formatYuan(merchant.stats.allTimeExpenseYuan) }}</span>
        </div>
        <div v-if="merchant.stats.unpaidPayableYuan > 0" class="finance-card finance-card--warn">
          <span class="finance-label">待支付应付</span>
          <span class="finance-value">¥ {{ formatYuan(merchant.stats.unpaidPayableYuan) }}</span>
          <span class="finance-sub">未取消且未支付订单</span>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'model' && model">
      <p class="finance-hint">
        已入账收入按分账完成时间统计；待结算含在途订单与已支付待分账订单的估算（与模特端看板一致）。
      </p>
      <div class="finance-grid">
        <div class="finance-card">
          <span class="finance-label">今日收入</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(model.stats.today.income) }}</span>
          <span class="finance-sub">{{ model.stats.today.orderCount }} 单（创建）</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本周收入</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(model.stats.week.income) }}</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本月收入</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(model.stats.month.income) }}</span>
        </div>
        <div class="finance-card finance-card--accent">
          <span class="finance-label">累计已分账收入</span>
          <span class="finance-value">¥ {{ formatYuan(model.allTimeIncomeYuan) }}</span>
          <span class="finance-sub">历史订单 {{ model.lifetimeOrderCount }} 单</span>
        </div>
        <div class="finance-card finance-card--warn">
          <span class="finance-label">待结算（估算）</span>
          <span class="finance-value">¥ {{ formatYuan(model.stats.today.pendingSettlement) }}</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">钱包可用</span>
          <span class="finance-value">¥ {{ formatYuan(model.wallet.availableYuan) }}</span>
          <span v-if="!model.wallet.ledgerTableReady" class="finance-sub">流水表未就绪</span>
          <span v-else-if="model.wallet.frozenYuan > 0" class="finance-sub">
            冻结 ¥ {{ formatYuan(model.wallet.frozenYuan) }}
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'broker' && broker">
      <p class="finance-hint">推荐佣金按分账完成时间入账；待结算为已支付待分账订单的佣金估算。</p>
      <div class="finance-grid">
        <div class="finance-card">
          <span class="finance-label">今日佣金</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(broker.stats.today.totalYuan) }}</span>
          <span class="finance-sub">商户绑定经纪人分成</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本周佣金</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(broker.stats.week.totalYuan) }}</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">本月佣金</span>
          <span class="finance-value finance-value--in">¥ {{ formatYuan(broker.stats.month.totalYuan) }}</span>
        </div>
        <div class="finance-card finance-card--accent">
          <span class="finance-label">累计已分账佣金</span>
          <span class="finance-value">¥ {{ formatYuan(broker.allTimeIncomeYuan) }}</span>
          <span class="finance-sub">
            绑定商家 {{ broker.stats.lockedMerchantCount }} 家
          </span>
        </div>
        <div class="finance-card finance-card--warn">
          <span class="finance-label">待结算（估算）</span>
          <span class="finance-value">¥ {{ formatYuan(broker.stats.today.pendingSettlementYuan) }}</span>
        </div>
        <div class="finance-card">
          <span class="finance-label">钱包可用</span>
          <span class="finance-value">¥ {{ formatYuan(broker.wallet.availableYuan) }}</span>
          <span v-if="!broker.wallet.ledgerTableReady" class="finance-sub">流水表未就绪</span>
        </div>
      </div>
    </template>

    <div v-if="trendRows.length" class="finance-trend">
      <div class="finance-trend-title">近 7 日趋势</div>
      <div class="finance-trend-bars">
        <div v-for="row in trendRows" :key="row.date" class="finance-trend-col">
          <span class="finance-trend-amt">¥{{ formatYuan(row.amount) }}</span>
          <div
            class="finance-trend-bar"
            :style="{ height: `${Math.max(4, Math.round((row.amount / trendMax) * 72))}px` }"
          />
          <span class="finance-trend-day">{{ row.label }}</span>
        </div>
      </div>
    </div>

    <el-empty v-if="!loading && !merchant && !model && !broker" description="暂无统计数据" />
  </section>
</template>

<style scoped>
.finance-stats {
  min-height: 120px;
}

.finance-hint {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.finance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

@media (max-width: 720px) {
  .finance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.finance-card {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.finance-card--accent {
  border-color: rgba(99, 102, 241, 0.35);
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.06), rgba(255, 255, 255, 0.98));
}

.finance-card--warn {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(254, 243, 199, 0.25);
}

.finance-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.finance-value {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #312e81;
}

.finance-value--in {
  color: #059669;
}

.finance-value--out {
  color: #dc2626;
}

.finance-sub {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.finance-trend-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.finance-trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 4px 4px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.finance-trend-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.finance-trend-amt {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transform: scale(0.92);
}

.finance-trend-bar {
  width: 100%;
  max-width: 36px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #818cf8, #4f46e5);
}

.finance-trend-day {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
