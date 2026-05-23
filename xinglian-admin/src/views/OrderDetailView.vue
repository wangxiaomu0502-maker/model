<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft } from "@element-plus/icons-vue";
import {
  fetchAdminOrderDetail,
  fetchAdminOrderSplitPreview,
  postAdminOrderSplit,
  type AdminOrderDetail,
  type AdminOrderPartyItem,
  type AdminOrderSplitPreview
} from "@/api/admin";
import { getAdminToken } from "@/composables/useAdminToken";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const splitting = ref(false);
const order = ref<AdminOrderDetail | null>(null);

const DURATION_LABELS: Record<string, string> = {
  full_day: "全天",
  half_day: "半天",
  hourly: "按小时"
};

const PAYMENT_LABELS: Record<number, string> = {
  0: "未支付",
  1: "已支付",
  2: "退款中",
  3: "已退款",
  4: "退款失败"
};

const ORDER_STATUS_LABELS: Record<number, string> = {
  1: "待模特确认接单",
  2: "进行中",
  3: "模特已完成",
  4: "已完成",
  9: "已取消"
};

function durationLabel(kind: string): string {
  return DURATION_LABELS[kind] ?? kind;
}

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
  if (status === 4) return "danger";
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

function formatPhone(v: string | null | undefined): string {
  const s = v?.trim();
  return s ? s : "—";
}

const orderParties = computed((): AdminOrderPartyItem[] => {
  const o = order.value;
  if (!o) return [];
  if (o.parties?.length) return o.parties;
  return [
    {
      role: "merchant",
      roleLabel: "商家",
      userNo: o.merchantUserNo || null,
      nickname: o.merchantNickname || null,
      realName: null,
      phone: o.merchantPhone ?? o.merchant?.phone ?? null
    },
    {
      role: "model",
      roleLabel: "模特",
      userNo: o.modelUserNo || null,
      nickname: o.modelNickname || null,
      realName: null,
      phone: o.modelPhone ?? o.model?.phone ?? null
    },
    {
      role: "broker",
      roleLabel: "经纪人",
      userNo: o.broker?.userNo ?? null,
      nickname: o.broker?.nickname ?? null,
      realName: o.broker?.realName ?? null,
      phone: o.broker?.phone ?? null
    },
    {
      role: "agent",
      roleLabel: "代理人",
      userNo: o.agent?.userNo ?? null,
      nickname: o.agent?.nickname ?? null,
      realName: o.agent?.realName ?? null,
      phone: o.agent?.phone ?? null,
      companyName: o.agent?.companyName ?? null
    }
  ];
});

function partyUnbound(p: AdminOrderPartyItem): boolean {
  return !p.userNo?.trim() && !p.phone?.trim() && !p.nickname?.trim();
}

const orderIdParam = computed(() => {
  const raw = route.params.orderId;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

/** 已完成、已支付、尚未写入分账时间 */
const showSplitAction = computed(() => {
  const o = order.value;
  if (!o) return false;
  return o.orderStatus === 4 && o.paymentStatus === 1 && (o.splitCalculatedAt == null || o.splitCalculatedAt === "");
});

function bpPct(bp: number): string {
  return `${bp / 100}%`;
}

function moneyTxt(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function splitAmtLine(props: {
  title: string;
  amount: string;
  subtitle: string | null;
  tone: "platform" | "model" | "ref";
}): ReturnType<typeof h> {
  return h(
    "div",
    {
      class: ["split-amt-line", `split-amt-line--${props.tone}`]
    },
    [
      h("div", { class: "split-amt-line-top" }, [
        h("span", { class: "split-amt-title" }, props.title),
        h("span", { class: "split-amt-money" }, props.amount)
      ]),
      props.subtitle ? h("div", { class: "split-amt-sub" }, props.subtitle) : null
    ]
  );
}

function splitChip(text: string): ReturnType<typeof h> {
  return h("span", { class: "split-chip" }, text);
}

/** 确认框内展示：与后端预览接口一致的分账明细 */
function splitPreviewContent(p: AdminOrderSplitPreview) {
  const { amountsYuan: a } = p;

  const rulePanelTitle =
    p.rulesSource === "order_complete_snapshot"
      ? "订单完成时锁定的比例"
      : p.rulesSource === "platform_table_live"
        ? "当前配置表（本单无完成快照，与后台全局一致）"
        : "分账比例";

  const ruleChips = [
    splitChip(`模特收入 ${bpPct(p.modelShareBp)}`),
    splitChip(`服务费 ${bpPct(p.platformFeeRateBp)}`),
    splitChip(`平台 ${bpPct(p.platformShareOfFeeBp ?? 0)} · 代理人 ${bpPct(p.agentShareOfFeeBp)} · 经纪人 ${bpPct(p.brokerShareOfFeeBp)}`)
  ];

  const lines: ReturnType<typeof h>[] = [
    splitAmtLine({
      tone: "platform",
      title: "平台技术服务费",
      subtitle: "平台留存 · 不产生用户流水",
      amount: moneyTxt(a.platformFee)
    }),
    splitAmtLine({
      tone: "model",
      title: "模特实收",
      subtitle: `入账用户 #${p.modelUserId}`,
      amount: moneyTxt(a.modelIncome)
    }),
    splitAmtLine({
      tone: "ref",
      title: "经纪人实收",
      subtitle:
        a.brokerIncome > 0 && p.brokerUserId != null ? `入账用户 #${p.brokerUserId}` : "—",
      amount: moneyTxt(a.brokerIncome)
    }),
    splitAmtLine({
      tone: "ref",
      title: "代理人实收",
      subtitle: a.agentIncome > 0 && p.agentUserId != null ? `入账用户 #${p.agentUserId}` : "—",
      amount: moneyTxt(a.agentIncome)
    })
  ];


  return h("div", { class: "split-preview-root" }, [
    h("div", { class: "split-preview-hero" }, [
      h("div", { class: "split-preview-hero-tags" }, [
        h("span", { class: "split-preview-pill split-preview-pill--accent" }, "分账预览"),
        h("span", { class: "split-preview-pill split-preview-pill--muted" }, `订单 · ${p.orderNo}`)
      ]),
      h("div", { class: "split-preview-payable-row" }, [
        h("span", { class: "split-preview-payable-label" }, "应付总额 P"),
        h("span", { class: "split-preview-payable-value" }, moneyTxt(p.payableAmountYuan))
      ]),
      h("div", { class: "split-preview-d-hint" }, [
        `模特 `,
        h("strong", bpPct(p.modelShareBp)),
        " + 服务费 ",
        h("strong", bpPct(p.platformFeeRateBp)),
        "；服务费内 ",
        h("strong", bpPct(p.platformShareOfFeeBp ?? 0)),
        " / ",
        h("strong", bpPct(p.agentShareOfFeeBp)),
        " / ",
        h("strong", bpPct(p.brokerShareOfFeeBp))
      ])
    ]),
    h("div", { class: "split-preview-panel" }, [
      h("div", { class: "split-preview-panel-head" }, rulePanelTitle),
      h("div", { class: "split-preview-chips" }, ruleChips)
    ]),
    h("div", { class: "split-preview-panel split-preview-panel--lines" }, [
      h("div", { class: "split-preview-panel-head" }, "分配结果（元）"),
      h("div", { class: "split-preview-lines" }, lines)
    ]),
    h("div", { class: "split-preview-foot" }, [
      h("span", { class: "split-preview-foot-icon" }, "注"),
      "确认后将写入订单分项，并为模特/经纪人/代理人入账；已分账订单不可重复操作。"
    ]),
  ]);
}

async function confirmRunSplit(): Promise<void> {
  const id = orderIdParam.value;
  if (id == null || !order.value) return;
  let preview: AdminOrderSplitPreview;
  try {
    preview = await fetchAdminOrderSplitPreview(id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "分账预览失败");
    return;
  }
  try {
    await ElMessageBox.confirm(splitPreviewContent(preview), "确认分账", {
      type: "warning",
      confirmButtonText: "执行分账",
      cancelButtonText: "取消",
      customClass: "order-split-preview-msgbox",
      showClose: true,
      closeOnClickModal: false,
      closeOnPressEscape: true
    });
  } catch {
    return;
  }
  splitting.value = true;
  try {
    order.value = await postAdminOrderSplit(id);
    ElMessage.success("分账已完成");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "分账失败");
  } finally {
    splitting.value = false;
  }
}

async function loadDetail(): Promise<void> {
  const id = orderIdParam.value;
  if (id == null) {
    ElMessage.error("无效的订单 ID");
    order.value = null;
    return;
  }
  if (!getAdminToken()) {
    ElMessage.warning("请先登录后台账号");
    order.value = null;
    return;
  }
  loading.value = true;
  try {
    order.value = await fetchAdminOrderDetail(id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    order.value = null;
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: "orders" });
}

onMounted(() => {
  void loadDetail();
});

watch(orderIdParam, () => {
  void loadDetail();
});
</script>

<template>
  <div v-loading="loading" class="alv-page od-page">
    <header class="alv-hero od-hero">
      <div class="od-hero-inner">
        <div class="alv-hero-text">
          <el-button text type="primary" class="od-back" @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回列表
          </el-button>
          <template v-if="order">
            <h1 class="alv-hero-title">订单详情</h1>
            <div class="od-order-row">
              <span class="alv-id-badge">{{ order.orderId }}</span>
              <div class="alv-order-block od-order-no-wrap">
                <span class="alv-order-no">{{ order.orderNo }}</span>
              </div>
            </div>
            <p class="alv-hero-sub od-hero-subline">
              下单 <span class="alv-time">{{ formatTime(order.createdAt) }}</span> · 档期
              <strong>{{ order.bookingDate }}</strong>
            </p>
            <div class="od-hero-tags">
              <el-tag
                class="head-tag"
                :type="orderStatusTagType(order.orderStatus)"
                size="small"
                effect="light"
                round
              >
                {{ orderStatusLabel(order.orderStatus) }}
              </el-tag>
              <el-tag
                class="head-tag"
                :type="paymentTagType(order.paymentStatus)"
                size="small"
                effect="light"
                round
              >
                {{ paymentLabel(order.paymentStatus) }}
              </el-tag>
            </div>
          </template>
          <template v-else-if="!loading">
            <h1 class="alv-hero-title">订单详情</h1>
            <p class="alv-hero-sub">暂无订单数据或无权查看</p>
          </template>
          <template v-else>
            <h1 class="alv-hero-title">订单详情</h1>
            <p class="alv-hero-sub">加载中…</p>
          </template>
        </div>
        <div v-if="order" class="alv-hero-meta od-hero-meta">
          <div class="alv-stat alv-stat--vio">
            <span class="alv-stat-label">应付总额</span>
            <span class="alv-stat-val tab-nums">
              ¥ {{ formatAmt(order.payableAmount) }}
            </span>
          </div>
          <div class="alv-stat alv-stat--muted">
            <span class="alv-stat-label">服务费</span>
            <span class="alv-stat-val tab-nums">¥ {{ formatAmt(order.serviceAmount) }}</span>
          </div>
          <div
            v-if="order.splitCalculatedAt"
            class="alv-stat alv-stat--ok"
          >
            <span class="alv-stat-label">分账</span>
            <span class="alv-stat-val">已入账</span>
          </div>
          <div
            v-else-if="showSplitAction"
            class="alv-stat alv-stat--warn"
          >
            <span class="alv-stat-label">分账</span>
            <span class="alv-stat-val">待执行</span>
          </div>
        </div>
      </div>
    </header>

    <template v-if="order">
      <el-card shadow="never" class="alv-card block od-card">
        <template #header><span class="card-h">标识与状态</span></template>
        <el-descriptions :column="2" border class="od-desc">
          <el-descriptions-item label="订单 ID">
            <span class="alv-id-badge">{{ order.orderId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单号" :span="2">
            <div class="alv-order-block">
              <span class="alv-order-no">{{ order.orderNo }}</span>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag
              :type="orderStatusTagType(order.orderStatus)"
              size="small"
              effect="light"
              round
            >
              {{ orderStatusLabel(order.orderStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付状态">
            <el-tag
              :type="paymentTagType(order.paymentStatus)"
              size="small"
              effect="light"
              round
            >
              {{ paymentLabel(order.paymentStatus) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="alv-card block od-card">
        <template #header><span class="card-h">参与方（4方）</span></template>
        <el-table :data="orderParties" border stripe class="od-party-table" style="width: 100%">
          <el-table-column prop="roleLabel" label="角色" width="88" />
          <el-table-column label="平台ID" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="alv-mono">{{ row.userNo?.trim() || "—" }}</span>
            </template>
          </el-table-column>
          <el-table-column label="昵称" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.nickname?.trim() || "—" }}</template>
          </el-table-column>
          <el-table-column label="实名/姓名" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.realName?.trim() || "—" }}</template>
          </el-table-column>
          <el-table-column label="手机号" width="130">
            <template #default="{ row }">
              <span class="alv-mono">{{ formatPhone(row.phone) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.role === 'agent' && row.companyName?.trim()">{{ row.companyName.trim() }}</span>
              <span v-else-if="partyUnbound(row)" class="od-party-muted">未绑定</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card v-if="showSplitAction" shadow="never" class="alv-card block od-card od-split-card">
        <template #header><span class="card-h">分账</span></template>
        <p class="split-hint">
          本订单已完成且已支付，尚未分账。点击下方按钮将按
          <strong>当前平台分账比例</strong> 写入订单分项，并记入相关用户账户流水与可用余额。
        </p>
        <el-button type="primary" size="large" round :loading="splitting" @click="confirmRunSplit">
          执行分账
        </el-button>
      </el-card>

      <el-card shadow="never" class="alv-card block od-card">
        <template #header><span class="card-h">预约、时长与价款</span></template>
        <el-descriptions :column="1" border class="od-desc">
          <el-descriptions-item label="创建时间（下单）">
            <span class="alv-time">{{ formatTime(order.createdAt) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="预约日">{{ order.bookingDate }}</el-descriptions-item>
          <el-descriptions-item label="时长">
            {{ durationLabel(order.durationKind) }}
            <template v-if="order.hourCount != null">（{{ order.hourCount }} 小时）</template>
          </el-descriptions-item>
          <el-descriptions-item label="单价快照（元）">
            <span class="od-money">{{ formatAmt(order.unitPriceSnapshot) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="服务费合计（元）">
            <span class="od-money">{{ formatAmt(order.serviceAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="平台费（元）">
            <span class="od-money">{{ formatAmt(order.platformFee) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="应付总额（元）">
            <span class="alv-amt od-payable-amt">
              <span class="alv-amt-cny">¥</span>{{ formatAmt(order.payableAmount) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="模特分成（元）">
            <span class="od-money">{{ formatAmt(order.modelIncome) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="经纪人分成（元）">
            <span class="od-money">{{ formatAmt(order.brokerIncome) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="代理人分成（元）">
            <span class="od-money">{{ formatAmt(order.agentIncome) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="分账计算时间">
            <span class="alv-time">{{ formatTime(order.splitCalculatedAt) }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="alv-card block od-card">
        <template #header><span class="card-h">支付</span></template>
        <el-descriptions :column="2" border class="od-desc">
          <el-descriptions-item label="支付方式">{{ order.paymentChannel || "—" }}</el-descriptions-item>
          <el-descriptions-item label="支付完成时间">
            <span class="alv-time">{{ formatTime(order.paidAt) }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="alv-card block od-card">
        <template #header><span class="card-h">时间与备注</span></template>
        <el-descriptions :column="1" border class="od-desc">
          <el-descriptions-item label="更新时间">
            <span class="alv-time">{{ formatTime(order.updatedAt) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            <span class="text-wrap-mono">{{ order.remark?.trim() ? order.remark : "—" }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <el-empty v-else-if="!loading" class="od-empty" description="暂无订单数据" />
  </div>
</template>

<style scoped>
.od-page {
  padding-bottom: 28px;
  box-sizing: border-box;
}

.od-hero {
  margin-bottom: 18px;
}

.od-hero-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
}

.od-back {
  margin: -4px 0 10px -10px;
  padding-left: 8px;
  font-weight: 600;
}

.od-order-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.od-order-no-wrap {
  flex: 1;
  min-width: 200px;
}

.od-hero-subline {
  margin-top: 10px;
}

.od-hero-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.od-hero-meta {
  align-self: center;
}

.head-tag {
  vertical-align: middle;
}

.od-card :deep(.el-card__header) {
  padding: 14px 18px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background: linear-gradient(180deg, #fafbff 0%, #f8fafc 100%);
}

.block {
  margin-bottom: 16px;
}

.card-h {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  color: var(--el-text-color-primary);
}

.sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.od-money {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 14px;
}

.od-payable-amt {
  font-size: 18px;
}

.tab-nums {
  font-variant-numeric: tabular-nums;
}

.od-desc :deep(.el-descriptions__label) {
  width: 148px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.od-desc :deep(.el-descriptions__content) {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.od-split-card :deep(.el-card__body) {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.06) 0%,
    rgba(255, 255, 255, 0.96) 48%
  );
}

.text-wrap-mono {
  display: inline-block;
  max-width: 100%;
  font-family: ui-monospace, SFMono-Regular, monospace;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.od-empty {
  padding: 48px 0;
}

.split-hint {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.od-party-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 900px) {
  .od-party-grid {
    grid-template-columns: 1fr;
  }
}

.od-party-block {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, #fafbff 0%, #f8fafc 100%);
}

.od-party-role {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}

.od-party-desc :deep(.el-descriptions__label) {
  width: 108px;
}

.od-party-muted {
  color: #94a3b8;
  font-size: 13px;
}

.od-party-empty {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
</style>

<!-- MessageBox 挂载到 body，需非 scoped 样式 -->
<style>
.order-split-preview-msgbox {
  width: min(536px, calc(100vw - 32px)) !important;
  max-width: none;
  padding-bottom: 12px;
  border-radius: 12px;
  box-shadow: var(--el-box-shadow);
}

.order-split-preview-msgbox .el-message-box__header {
  padding: 18px 22px 12px;
}

.order-split-preview-msgbox .el-message-box__title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.order-split-preview-msgbox .el-message-box__status {
  font-size: 22px;
}

.order-split-preview-msgbox .el-message-box__headerbtn {
  top: 14px;
}

.order-split-preview-msgbox .el-message-box__message {
  padding: 0 20px 20px;
}

.order-split-preview-msgbox .el-message-box__btns {
  padding: 10px 22px 14px;
}

.order-split-preview-msgbox .el-message-box__btns .el-button {
  min-width: 100px;
}

.order-split-preview-msgbox .split-preview-root {
  text-align: left;
  margin: 4px 2px 0;
  color: var(--el-text-color-primary);
}

/* 顶部：应付强调 */
.order-split-preview-msgbox .split-preview-hero {
  padding: 14px 16px 16px;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-fill-color-lighter) 100%
  );
  border: 1px solid var(--el-border-color-lighter);
}

.order-split-preview-msgbox .split-preview-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.order-split-preview-msgbox .split-preview-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.order-split-preview-msgbox .split-preview-pill--accent {
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

.order-split-preview-msgbox .split-preview-pill--muted {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, monospace;
  font-weight: 500;
}

.order-split-preview-msgbox .split-preview-payable-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.order-split-preview-msgbox .split-preview-payable-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.order-split-preview-msgbox .split-preview-payable-value {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
  letter-spacing: -0.02em;
}

.order-split-preview-msgbox .split-preview-d-hint {
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.order-split-preview-msgbox .split-preview-d-hint strong {
  color: var(--el-text-color-regular);
  font-weight: 600;
}

/* 中段面板 */
.order-split-preview-msgbox .split-preview-panel {
  margin-top: 14px;
  padding: 12px 14px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.order-split-preview-msgbox .split-preview-panel--lines {
  padding-bottom: 10px;
}

.order-split-preview-msgbox .split-preview-panel-head {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
  letter-spacing: 0.04em;
}

.order-split-preview-msgbox .split-preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.order-split-preview-msgbox .split-chip {
  display: inline-block;
  padding: 6px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color-extra-light);
}

.order-split-preview-msgbox .split-preview-lines {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
}

.order-split-preview-msgbox .split-amt-line {
  padding: 11px 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-blank);
}

.order-split-preview-msgbox .split-amt-line:last-child {
  border-bottom: none;
}

.order-split-preview-msgbox .split-amt-line--platform {
  background: linear-gradient(180deg, var(--el-fill-color-extra-light) 0%, var(--el-fill-color-blank) 100%);
}

.order-split-preview-msgbox .split-amt-line--model {
  border-inline-start: 3px solid var(--el-color-success);
  padding-inline-start: 9px;
}

.order-split-preview-msgbox .split-amt-line--ref {
  border-inline-start: 3px solid var(--el-color-warning);
  padding-inline-start: 9px;
}

.order-split-preview-msgbox .split-amt-line-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.order-split-preview-msgbox .split-amt-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.order-split-preview-msgbox .split-amt-money {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.order-split-preview-msgbox .split-amt-sub {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, monospace;
}

.order-split-preview-msgbox .split-amt-line--platform .split-amt-money {
  color: var(--el-text-color-regular);
}

.order-split-preview-msgbox .split-amt-line--platform .split-amt-sub {
  font-family: inherit;
}

/* 底部提示与说明 */
.order-split-preview-msgbox .split-preview-foot {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  padding: 11px 13px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
  background: var(--el-color-info-light-9);
  border: 1px solid var(--el-color-info-light-7);
}

.order-split-preview-msgbox .split-preview-foot-icon {
  flex-shrink: 0;
  min-width: 22px;
  padding: 0 5px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  background: var(--el-color-info-light-5);
  color: var(--el-color-info-dark-2);
}

.order-split-preview-msgbox .split-preview-notes {
  margin-top: 12px;
  padding: 11px 13px 13px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
}

.order-split-preview-msgbox .split-preview-note-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
  padding-top: 6px;
}

.order-split-preview-msgbox .split-preview-note-item:first-child {
  padding-top: 0;
}

.order-split-preview-msgbox .split-preview-note-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--el-color-warning);
  opacity: 0.85;
}
</style>
