<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Coin,
  PieChart,
  Share,
  Shop,
  UserFilled
} from "@element-plus/icons-vue";

import {
  fetchAdminSplitRules,
  updateAdminSplitRules,
  type AdminSplitRulesUpdateBody
} from "@/api/admin";

const loading = ref(true);
const saving = ref(false);

/** 展示用：整数百分比（如 15 表示 15%），bp = pct × 100（万分比，仅支持整数%） */
const form = reactive({
  /** 服务费占 P（与 modelPct 之和须为 100） */
  serviceFeePct: 15,
  modelPct: 85,
  platformFeePct: 34,
  agentPct: 33,
  brokerPct: 33
});

const updatedAt = ref<string>("");

function bpToPct(bp: number): number {
  return Math.round(bp / 100);
}

function pctToBp(pct: number): number {
  return Math.round(pct) * 100;
}

const sumMainPct = computed(() => form.modelPct + form.serviceFeePct);

const sumFeePct = computed(
  () => form.platformFeePct + form.agentPct + form.brokerPct
);

const feeBarWidths = computed(() => {
  const p = form.platformFeePct;
  const a = form.agentPct;
  const b = form.brokerPct;
  const sum = p + a + b;
  if (sum <= 0) return { p: 33.34, a: 33.33, b: 33.33 };
  return { p: (p / sum) * 100, a: (a / sum) * 100, b: (b / sum) * 100 };
});

/** 服务端常为 UTC ISO 字符串，展示为中国本地日程时间 */
const updatedAtDisplay = computed(() => {
  const iso = updatedAt.value;
  if (!iso) return "尚未保存";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchAdminSplitRules();
    form.modelPct = bpToPct(data.modelShareBp);
    form.serviceFeePct = bpToPct(data.platformFeeRateBp);
    form.platformFeePct = bpToPct(data.platformShareOfFeeBp);
    form.agentPct = bpToPct(data.agentShareOfFeeBp);
    form.brokerPct = bpToPct(data.brokerShareOfFeeBp);
    updatedAt.value = data.updatedAt || "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onSave(): Promise<void> {
  if (sumMainPct.value !== 100) {
    ElMessage.warning("模特收入 + 服务费 占比之和须为 100%");
    return;
  }
  if (sumFeePct.value !== 100) {
    ElMessage.warning("服务费内：平台 + 代理人 + 经纪人 占比之和须为 100%");
    return;
  }

  const body: AdminSplitRulesUpdateBody = {
    platformFeeRateBp: pctToBp(form.serviceFeePct),
    modelShareBp: pctToBp(form.modelPct),
    platformShareOfFeeBp: pctToBp(form.platformFeePct),
    agentShareOfFeeBp: pctToBp(form.agentPct),
    brokerShareOfFeeBp: pctToBp(form.brokerPct)
  };

  saving.value = true;
  try {
    const data = await updateAdminSplitRules(body);
    updatedAt.value = data.updatedAt || "";
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

watch(
  () => form.modelPct,
  (v) => {
    form.serviceFeePct = Math.max(0, 100 - Number(v || 0));
  }
);

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-visual" aria-hidden="true">
        <el-icon class="hero-icon"><PieChart /></el-icon>
      </div>
      <div class="hero-text">
        <h1 class="hero-title">分账配置</h1>
      </div>
    </header>

    <div class="panels" v-loading="loading">
      <section class="panel panel-flow" aria-label="资金流向示意">
        <span class="flow-chip flow-p">P 应付</span>
        <span class="flow-arrow">−</span>
        <span class="flow-chip flow-m">模特 {{ form.modelPct }}%</span>
        <span class="flow-arrow">+</span>
        <span class="flow-chip flow-r">服务费 {{ form.serviceFeePct }}%</span>
      </section>

      <section class="panel panel-platform">
        <div class="panel-head">
          <div class="panel-icon-wrap panel-icon-wrap--fee">
            <el-icon><Coin /></el-icon>
          </div>
          <div>
            <h2 class="panel-title">模特收入占比</h2>
            <p class="panel-sub">占应付总额 P；其余为服务费，在平台/代理人/经纪人之间分配。</p>
          </div>
        </div>
        <div class="panel-body platform-row">
          <div class="field-block">
            <span class="field-label">模特收入（占 P）</span>
            <div class="field-inline">
              <el-input-number
                v-model="form.modelPct"
                :min="0"
                :max="100"
                :precision="0"
                :step="1"
                class="pct-input"
              />
              <span class="suffix">%</span>
            </div>
            <p class="panel-sub">服务费 = {{ form.serviceFeePct }}%（自动补足 100%）</p>
          </div>
        </div>
      </section>

      <section class="panel panel-pool">
        <div class="panel-head">
          <div class="panel-icon-wrap panel-icon-wrap--pool">
            <el-icon><Share /></el-icon>
          </div>
          <div>
            <h2 class="panel-title">服务费内 · 平台 / 代理人 / 经纪人</h2>
            <p class="panel-sub">占服务费 100%；无代理人或无绑定经纪人时，对应份额归入平台。</p>
          </div>
        </div>

        <div class="alloc-preview" aria-label="服务费内三方分配预览">
          <div class="alloc-preview-track">
            <div
              class="alloc-preview-seg seg-m"
              :style="{ width: `${feeBarWidths.p}%` }"
              :title="`平台 ${form.platformFeePct}%`"
            />
            <div
              class="alloc-preview-seg seg-t"
              :style="{ width: `${feeBarWidths.a}%` }"
              :title="`代理人 ${form.agentPct}%`"
            />
            <div
              class="alloc-preview-seg seg-m"
              :style="{ width: `${feeBarWidths.b}%` }"
              :title="`经纪人 ${form.brokerPct}%`"
            />
          </div>
          <div class="alloc-preview-legend">
            <span><i class="dot dot-s" /> 平台 {{ form.platformFeePct }}%</span>
            <span><i class="dot dot-t" /> 代理人 {{ form.agentPct }}%</span>
            <span><i class="dot dot-m" /> 经纪人 {{ form.brokerPct }}%</span>
          </div>
        </div>

        <div class="alloc-cards">
          <div class="alloc-card alloc-card--m">
            <div class="alloc-card-icon">
              <el-icon><UserFilled /></el-icon>
            </div>
            <span class="alloc-card-label">平台</span>
            <div class="alloc-card-input">
              <el-input-number
                v-model="form.platformFeePct"
                :min="0"
                :max="100"
                :precision="0"
                :step="1"
                class="pct-input pct-input--wide"
              />
              <span class="suffix">%</span>
            </div>
          </div>
          <div class="alloc-card alloc-card--s">
            <div class="alloc-card-icon">
              <el-icon><Shop /></el-icon>
            </div>
            <span class="alloc-card-label">代理人</span>
            <div class="alloc-card-input">
              <el-input-number
                v-model="form.agentPct"
                :min="0"
                :max="100"
                :precision="0"
                :step="1"
                class="pct-input pct-input--wide"
              />
              <span class="suffix">%</span>
            </div>
          </div>
          <div class="alloc-card alloc-card--t">
            <div class="alloc-card-icon">
              <el-icon><Share /></el-icon>
            </div>
            <span class="alloc-card-label">经纪人</span>
            <div class="alloc-card-input">
              <el-input-number
                v-model="form.brokerPct"
                :min="0"
                :max="100"
                :precision="0"
                :step="1"
                class="pct-input pct-input--wide"
              />
              <span class="suffix">%</span>
            </div>
          </div>
        </div>

        <div class="sum-banner" :class="{ 'sum-banner--bad': sumFeePct !== 100 }">
          <span class="sum-banner-label">服务费合计</span>
          <span class="sum-banner-value">{{ sumFeePct }}%（平台+代理人+经纪人）</span>
        </div>
        <div class="sum-banner" :class="{ 'sum-banner--bad': sumMainPct !== 100 }">
          <span class="sum-banner-label">应付合计</span>
          <span class="sum-banner-value">模特 + 服务费 = {{ sumMainPct }}%</span>
        </div>
      </section>

      <footer class="footer-actions">
        <div class="footer-meta">
          <span class="footer-meta-label">最近保存</span>
          <span class="footer-meta-value">{{ updatedAtDisplay }}</span>
        </div>
        <el-button type="primary" size="large" round :loading="saving" class="save-btn" @click="onSave">
          保存配置
        </el-button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px 20px;
  margin-bottom: 20px;
}

.hero-visual {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-icon {
  font-size: 26px;
}

.hero-text {
  flex: 1;
  min-width: 200px;
}

.hero-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 120px;
}

.panel {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  padding: 18px 20px;
}

.panel-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.65));
}

.flow-chip {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.flow-p {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.flow-r {
  background: rgba(234, 179, 8, 0.14);
  color: #a16207;
}

.flow-d {
  background: rgba(99, 102, 241, 0.1);
  color: #4338ca;
}

.flow-arrow {
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}

.panel-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.panel-icon-wrap--fee {
  background: rgba(234, 179, 8, 0.16);
  color: #ca8a04;
}

.panel-icon-wrap--pool {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.panel-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.panel-sub {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}

.platform-row {
  padding-top: 4px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.field-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alloc-preview {
  margin-bottom: 18px;
}

.alloc-preview-track {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(226, 232, 240, 0.85);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06);
}

.alloc-preview-seg {
  min-width: 4px;
  transition: width 0.25s ease;
}

.seg-m {
  background: linear-gradient(180deg, #6366f1, #4f46e5);
}

.seg-s {
  background: linear-gradient(180deg, #0ea5e9, #0284c7);
}

.seg-t {
  background: linear-gradient(180deg, #34d399, #059669);
}

.alloc-preview-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.alloc-preview-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.dot-m {
  background: #4f46e5;
}
.dot-s {
  background: #0284c7;
}
.dot-t {
  background: #059669;
}

.alloc-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 720px) {
  .alloc-cards {
    grid-template-columns: 1fr;
  }
}

.alloc-card {
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  padding: 14px;
  background: rgba(248, 250, 252, 0.65);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.alloc-card:hover {
  border-color: rgba(99, 102, 241, 0.22);
  box-shadow: 0 8px 22px -14px rgba(79, 70, 229, 0.35);
}

.alloc-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 10px;
}

.alloc-card--m .alloc-card-icon {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.alloc-card--s .alloc-card-icon {
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
}

.alloc-card--t .alloc-card-icon {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.alloc-card-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
}

.alloc-card-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sum-banner {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.22);
}

.sum-banner--bad {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.22);
}

.sum-banner-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.sum-banner-value {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #059669;
}

.sum-banner--bad .sum-banner-value {
  color: #dc2626;
}

.sum-banner-hint {
  font-size: 13px;
  font-weight: 600;
  color: #dc2626;
}

.sum-banner-ok {
  font-size: 13px;
  font-weight: 600;
  color: #059669;
}

.panel-policy {
  padding-bottom: 20px;
}

.policy-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 700;
}

.policy-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.policy-radios {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 0;
  vertical-align: middle;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 18px -8px rgba(15, 23, 42, 0.08);
}

.footer-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-meta-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
}

.footer-meta-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.save-btn {
  min-width: 132px;
  font-weight: 700;
}

/* 默认左右步进组件宽约 150px；略加宽以免挤占中间数字区 */
.pct-input {
  width: auto;
  min-width: 184px;
}

.pct-input--wide {
  width: 100%;
  max-width: 220px;
  min-width: 184px;
}

.suffix {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
}

/* 默认布局下两侧按钮自带圆角，整块外观连贯；略加大圆角与后台卡片风格一致 */
:deep(.pct-input.el-input-number) {
  --el-border-radius-base: 10px;
}

:deep(.policy-radios .el-radio-button__inner) {
  font-weight: 600;
  padding: 10px 18px;
}
</style>
