<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

import {
  addPendingOrderNote,
  completePendingOrder,
  fetchPendingOrderDetail,
  fetchPendingOrders,
  startPendingOrder,
  type CsOrderParty,
  type CsPendingOrderDetail,
  type CsPendingOrderRow
} from "@/api/admin";
import { getAdminRole } from "@/composables/useAdminToken";
import { useIsMobile } from "@/composables/useIsMobile";

const CS_STATUS = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3
} as const;

const { isMobile } = useIsMobile();

const loading = ref(false);
const list = ref<CsPendingOrderRow[]>([]);
const total = ref(0);
const pager = reactive({ page: 1, pageSize: 20 });
const statusTab = ref<"all" | "1" | "2" | "3">("1");

const drawerVisible = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const detail = ref<CsPendingOrderDetail | null>(null);
const noteInput = ref("");

const csStatusFilter = computed(() => {
  if (statusTab.value === "all") return undefined;
  return Number(statusTab.value);
});

const isReadOnly = computed(() => getAdminRole() === "admin");

const drawerSize = computed(() => (isMobile.value ? "100%" : "70%"));

const pageTitle = computed(() => (isReadOnly.value ? "待客服处理订单" : "待处理订单"));

const pageDesc = computed(() =>
  isReadOnly.value
    ? "查看已进入客服队列的订单及备注，处理操作由客服账号执行。"
    : "模特接单后自动进入本队列，请按流程处理并记录备注。"
);

const mobilePageDesc = computed(() =>
  isReadOnly.value ? "仅查看，处理需客服账号" : "接单后进队，请及时处理"
);

const mobileTabs = [
  { key: "all" as const, label: "全部" },
  { key: "1" as const, label: "待处理" },
  { key: "2" as const, label: "处理中" },
  { key: "3" as const, label: "已完成" }
];

function onMobileTabTap(key: (typeof mobileTabs)[number]["key"]): void {
  if (statusTab.value === key) return;
  statusTab.value = key;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** 列表卡片用短日期 */
function formatTimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAmt(v: number): string {
  return Number(v).toFixed(2);
}

function formatPhone(v: string | null | undefined): string {
  const s = v?.trim();
  return s ? s : "—";
}

function partyRemark(row: CsOrderParty): string {
  if (row.role === "agent" && row.companyName?.trim()) return row.companyName.trim();
  if (!row.userNo?.trim() && !row.phone?.trim()) return "未绑定";
  return "—";
}

const detailParties = computed((): CsOrderParty[] => {
  const d = detail.value;
  if (!d) return [];
  if (d.parties?.length) return d.parties;
  return [
    {
      role: "merchant",
      roleLabel: "商家",
      userId: null,
      userNo: d.merchantUserNo || null,
      nickname: d.merchantNickname || null,
      realName: null,
      phone: null,
      companyName: null
    },
    {
      role: "model",
      roleLabel: "模特",
      userId: null,
      userNo: d.modelUserNo || null,
      nickname: d.modelNickname || null,
      realName: null,
      phone: null,
      companyName: null
    },
    {
      role: "broker",
      roleLabel: "经纪人",
      userId: null,
      userNo: null,
      nickname: null,
      realName: null,
      phone: null,
      companyName: null
    },
    {
      role: "agent",
      roleLabel: "代理人",
      userId: null,
      userNo: null,
      nickname: null,
      realName: null,
      phone: null,
      companyName: null
    }
  ];
});

const showDrawerStickyActions = computed(() => {
  if (!detail.value || isReadOnly.value) return false;
  return detail.value.actions.canStart || detail.value.actions.canComplete;
});

function csStatusTagType(
  status: number
): "warning" | "primary" | "success" | "info" {
  if (status === CS_STATUS.PENDING) return "warning";
  if (status === CS_STATUS.PROCESSING) return "primary";
  if (status === CS_STATUS.COMPLETED) return "success";
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

function noteAuthor(note: { adminDisplayName: string | null; adminUsername: string }): string {
  return note.adminDisplayName?.trim() || note.adminUsername || "客服";
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await fetchPendingOrders(pager.page, pager.pageSize, csStatusFilter.value);
    list.value = data.list;
    total.value = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: CsPendingOrderRow): Promise<void> {
  drawerVisible.value = true;
  detailLoading.value = true;
  noteInput.value = "";
  try {
    detail.value = await fetchPendingOrderDetail(row.orderId);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载详情失败");
    drawerVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function onStart(): Promise<void> {
  if (!detail.value) return;
  actionLoading.value = true;
  try {
    detail.value = await startPendingOrder(detail.value.orderId);
    ElMessage.success("已开始处理");
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    actionLoading.value = false;
  }
}

async function onComplete(): Promise<void> {
  if (!detail.value) return;
  try {
    await ElMessageBox.confirm("确认将该订单标记为客服处理完成？", "处理完成", {
      type: "warning",
      confirmButtonText: "确认完成",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  actionLoading.value = true;
  try {
    detail.value = await completePendingOrder(detail.value.orderId);
    ElMessage.success("已标记为处理完成");
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    actionLoading.value = false;
  }
}

async function onAddNote(): Promise<void> {
  if (!detail.value) return;
  const text = noteInput.value.trim();
  if (!text) {
    ElMessage.warning("请输入备注内容");
    return;
  }
  actionLoading.value = true;
  try {
    const note = await addPendingOrderNote(detail.value.orderId, text);
    detail.value.notes = [...(detail.value.notes ?? []), note];
    detail.value.noteCount = (detail.value.noteCount ?? 0) + 1;
    noteInput.value = "";
    ElMessage.success("备注已添加");
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "添加失败");
  } finally {
    actionLoading.value = false;
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

watch(statusTab, () => {
  pager.page = 1;
  void loadList();
});

onMounted(() => {
  void loadList();
});
</script>

<template>
  <!-- PC -->
  <div v-if="!isMobile" class="pending-orders-root pending-orders-root--pc">
    <header class="po-pc-head">
      <h1 class="po-pc-title">{{ pageTitle }}</h1>
      <p class="po-pc-desc">{{ pageDesc }}</p>
    </header>

    <el-card shadow="never" class="po-pc-card">
      <el-alert
        v-if="isReadOnly"
        class="po-readonly-alert"
        type="info"
        :closable="false"
        show-icon
        title="管理员仅可查看，不可开始处理、完成或添加备注。"
      />
      <el-tabs v-model="statusTab" class="po-status-tabs">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane label="待处理" name="1" />
        <el-tab-pane label="处理中" name="2" />
        <el-tab-pane label="已完成" name="3" />
      </el-tabs>

      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" min-width="148" />
        <el-table-column label="客服状态" width="100">
          <template #default="{ row }">
            <el-tag :type="csStatusTagType(row.csStatus)" size="small">{{ row.csStatusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="业务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="orderStatusTagType(row.orderStatus)" size="small">
              {{ row.orderStatusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预约日期" width="112" prop="bookingDate" />
        <el-table-column label="商家" min-width="100">
          <template #default="{ row }">{{ row.merchantNickname || "—" }}</template>
        </el-table-column>
        <el-table-column label="模特" min-width="100">
          <template #default="{ row }">{{ row.modelNickname || "—" }}</template>
        </el-table-column>
        <el-table-column label="应付(元)" width="96" align="right">
          <template #default="{ row }">{{ formatAmt(row.payableAmount) }}</template>
        </el-table-column>
        <el-table-column label="备注数" width="72" align="center" prop="noteCount" />
        <el-table-column label="进队时间" min-width="158">
          <template #default="{ row }">{{ formatTime(row.csQueuedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              {{ isReadOnly ? "查看" : "处理" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="po-pager">
        <el-pagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>
  </div>

  <!-- 移动端 -->
  <div v-else class="pending-orders-root pending-orders-root--mobile">
    <div class="po-m-shell">
      <header class="po-m-hero">
        <h1 class="po-m-title">{{ pageTitle }}</h1>
        <p class="po-m-desc">{{ mobilePageDesc }}</p>
        <p v-if="total > 0" class="po-m-count">共 {{ total }} 笔</p>
      </header>

    <el-alert
      v-if="isReadOnly"
      class="po-m-readonly"
      type="info"
      :closable="false"
      show-icon
      title="管理员仅可查看"
    />

    <nav class="po-m-tabs-bar" aria-label="筛选状态">
      <button
        v-for="tab in mobileTabs"
        :key="tab.key"
        type="button"
        class="po-m-tab"
        :class="{ 'po-m-tab--on': statusTab === tab.key }"
        @click="onMobileTabTap(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div v-loading="loading" class="po-m-list">
      <el-empty v-if="!loading && list.length === 0" class="po-m-empty" description="暂无订单" />
      <article
        v-for="row in list"
        :key="row.orderId"
        class="po-m-card"
        role="button"
        tabindex="0"
        @click="openDetail(row)"
        @keyup.enter="openDetail(row)"
      >
        <div class="po-m-card-tags">
          <el-tag :type="csStatusTagType(row.csStatus)" size="small" effect="light">
            {{ row.csStatusText }}
          </el-tag>
          <el-tag :type="orderStatusTagType(row.orderStatus)" size="small" effect="plain">
            {{ row.orderStatusText }}
          </el-tag>
        </div>
        <p class="po-m-order-no">{{ row.orderNo }}</p>
        <dl class="po-m-meta">
          <div class="po-m-meta-row">
            <dt>预约</dt>
            <dd>{{ row.bookingDate }}</dd>
          </div>
          <div class="po-m-meta-row">
            <dt>商家</dt>
            <dd>{{ row.merchantNickname || "—" }}</dd>
          </div>
          <div class="po-m-meta-row">
            <dt>模特</dt>
            <dd>{{ row.modelNickname || "—" }}</dd>
          </div>
          <div class="po-m-meta-row po-m-meta-row--muted">
            <dt>进队</dt>
            <dd>{{ formatTimeShort(row.csQueuedAt) }}</dd>
          </div>
        </dl>
        <div class="po-m-card-foot">
          <div class="po-m-foot-left">
            <span class="po-m-amount">¥{{ formatAmt(row.payableAmount) }}</span>
            <span v-if="row.noteCount > 0" class="po-m-note-badge">{{ row.noteCount }} 条备注</span>
          </div>
          <span class="po-m-cta">{{ isReadOnly ? "查看" : "处理" }}</span>
        </div>
      </article>
    </div>

    <div v-if="total > 0" class="po-m-pager">
      <el-pagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.pageSize"
        :total="total"
        :page-sizes="[10, 20]"
        layout="prev, pager, next"
        small
        background
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
    </div>
  </div>

  <el-drawer
    v-model="drawerVisible"
    :title="detail ? `订单 ${detail.orderNo}` : '订单详情'"
    :size="drawerSize"
    destroy-on-close
    :class="[
      'po-drawer',
      isMobile ? 'pending-orders-root--mobile' : 'pending-orders-root--pc'
    ]"
    :direction="isMobile ? 'btt' : 'rtl'"
  >
    <div
      v-loading="detailLoading || actionLoading"
      :class="isMobile ? 'po-m-drawer-wrap' : 'po-drawer-body'"
    >
      <template v-if="detail">
        <template v-if="isMobile">
          <div class="po-m-drawer-scroll">
            <section class="po-m-panel">
              <h3 class="po-section-title">订单信息</h3>
              <dl class="po-m-kv">
                <dt>客服状态</dt>
                <dd>
                  <el-tag :type="csStatusTagType(detail.csStatus)" size="small">
                    {{ detail.csStatusText }}
                  </el-tag>
                </dd>
                <dt>业务状态</dt>
                <dd>{{ detail.orderStatusText }}</dd>
                <dt>预约</dt>
                <dd>
                  {{ detail.bookingDate }} · {{ detail.durationKindText }}
                  <template v-if="detail.hourCount">（{{ detail.hourCount }}小时）</template>
                </dd>
                <dt>应付</dt>
                <dd>¥ {{ formatAmt(detail.payableAmount) }}</dd>
                <dt>进队</dt>
                <dd>{{ formatTime(detail.csQueuedAt) }}</dd>
                <template v-if="detail.csStartedAt">
                  <dt>开始</dt>
                  <dd>{{ formatTime(detail.csStartedAt) }}</dd>
                </template>
                <template v-if="detail.csCompletedAt">
                  <dt>完成</dt>
                  <dd>{{ formatTime(detail.csCompletedAt) }}</dd>
                </template>
              </dl>
            </section>

            <section class="po-m-panel">
              <h3 class="po-section-title">参与方</h3>
              <div
                v-for="party in detailParties"
                :key="party.role"
                class="po-m-party-card"
              >
                <div class="po-m-party-role">{{ party.roleLabel }}</div>
                <div class="po-m-party-row">
                  <span class="po-m-party-label">平台ID</span>
                  <span class="po-m-party-val po-mono">{{ party.userNo?.trim() || "—" }}</span>
                </div>
                <div class="po-m-party-row">
                  <span class="po-m-party-label">昵称</span>
                  <span class="po-m-party-val">{{ party.nickname?.trim() || "—" }}</span>
                </div>
                <div class="po-m-party-row">
                  <span class="po-m-party-label">姓名</span>
                  <span class="po-m-party-val">{{ party.realName?.trim() || "—" }}</span>
                </div>
                <div class="po-m-party-row">
                  <span class="po-m-party-label">手机</span>
                  <a
                    v-if="party.phone?.trim()"
                    class="po-m-party-val po-m-party-tel po-mono"
                    :href="`tel:${party.phone.trim()}`"
                    @click.stop
                  >{{ party.phone.trim() }}</a>
                  <span v-else class="po-m-party-val po-mono">—</span>
                </div>
                <div class="po-m-party-row">
                  <span class="po-m-party-label">备注</span>
                  <span
                    class="po-m-party-val"
                    :class="{ 'po-muted': partyRemark(party) === '未绑定' }"
                  >
                    {{ partyRemark(party) }}
                  </span>
                </div>
              </div>
            </section>

            <section class="po-m-panel">
              <h3 class="po-section-title">备注（{{ detail.notes?.length ?? 0 }}）</h3>
              <div v-if="detail.notes?.length" class="po-notes-list">
                <article v-for="note in detail.notes" :key="note.id" class="po-note-item">
                  <header class="po-note-meta">
                    <span class="po-note-author">{{ noteAuthor(note) }}</span>
                    <time>{{ formatTime(note.createdAt) }}</time>
                  </header>
                  <p class="po-note-content">{{ note.content }}</p>
                </article>
              </div>
              <el-empty v-else description="暂无备注" :image-size="56" />
              <div v-if="detail.actions.canAddNote" class="po-note-form">
                <el-input
                  v-model="noteInput"
                  type="textarea"
                  :rows="3"
                  maxlength="2000"
                  show-word-limit
                  placeholder="输入备注"
                />
                <el-button
                  class="po-note-submit"
                  type="primary"
                  :loading="actionLoading"
                  :disabled="!noteInput.trim()"
                  @click="onAddNote"
                >
                  添加备注
                </el-button>
              </div>
            </section>
          </div>

          <div v-if="showDrawerStickyActions" class="po-m-drawer-sticky">
            <el-button
              v-if="detail.actions.canStart"
              type="primary"
              size="large"
              :loading="actionLoading"
              @click="onStart"
            >
              开始处理
            </el-button>
            <el-button
              v-if="detail.actions.canComplete"
              type="success"
              size="large"
              :loading="actionLoading"
              @click="onComplete"
            >
              处理完成
            </el-button>
          </div>
        </template>

        <template v-else>
          <section class="po-section">
            <h3 class="po-section-title">订单信息</h3>
            <dl class="po-info-grid">
              <dt>客服状态</dt>
              <dd>
                <el-tag :type="csStatusTagType(detail.csStatus)" size="small">
                  {{ detail.csStatusText }}
                </el-tag>
              </dd>
              <dt>业务状态</dt>
              <dd>{{ detail.orderStatusText }}</dd>
              <dt>预约</dt>
              <dd>
                {{ detail.bookingDate }}
                · {{ detail.durationKindText }}
                <template v-if="detail.hourCount">（{{ detail.hourCount }}小时）</template>
              </dd>
              <dt>应付金额</dt>
              <dd>¥ {{ formatAmt(detail.payableAmount) }}</dd>
              <dt>进队时间</dt>
              <dd>{{ formatTime(detail.csQueuedAt) }}</dd>
              <dt v-if="detail.csStartedAt">开始处理</dt>
              <dd v-if="detail.csStartedAt">{{ formatTime(detail.csStartedAt) }}</dd>
              <dt v-if="detail.csCompletedAt">处理完成</dt>
              <dd v-if="detail.csCompletedAt">{{ formatTime(detail.csCompletedAt) }}</dd>
            </dl>
          </section>

          <section class="po-section">
            <h3 class="po-section-title">参与方（4方）</h3>
            <el-table
              :data="detailParties"
              border
              stripe
              size="default"
              class="po-party-table"
              style="width: 100%"
            >
              <el-table-column prop="roleLabel" label="角色" width="88" fixed />
              <el-table-column label="平台ID" min-width="128" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="po-mono">{{ row.userNo?.trim() || "—" }}</span>
                </template>
              </el-table-column>
              <el-table-column label="昵称" min-width="100" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.nickname?.trim() || "—" }}
                </template>
              </el-table-column>
              <el-table-column label="实名/姓名" min-width="100" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.realName?.trim() || "—" }}
                </template>
              </el-table-column>
              <el-table-column label="手机号" width="130">
                <template #default="{ row }">
                  <span class="po-mono po-phone">{{ formatPhone(row.phone) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">
                  <span :class="{ 'po-muted': partyRemark(row) === '未绑定' }">
                    {{ partyRemark(row) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section
            v-if="!isReadOnly && (detail.actions.canStart || detail.actions.canComplete)"
            class="po-section po-actions-row"
          >
            <el-button
              v-if="detail.actions.canStart"
              type="primary"
              :loading="actionLoading"
              @click="onStart"
            >
              开始处理
            </el-button>
            <el-button
              v-if="detail.actions.canComplete"
              type="success"
              :loading="actionLoading"
              @click="onComplete"
            >
              处理完成
            </el-button>
          </section>

          <section class="po-section">
            <h3 class="po-section-title">备注（{{ detail.notes?.length ?? 0 }}）</h3>
            <div v-if="detail.notes?.length" class="po-notes-list">
              <article v-for="note in detail.notes" :key="note.id" class="po-note-item">
                <header class="po-note-meta">
                  <span class="po-note-author">{{ noteAuthor(note) }}</span>
                  <time>{{ formatTime(note.createdAt) }}</time>
                </header>
                <p class="po-note-content">{{ note.content }}</p>
              </article>
            </div>
            <el-empty v-else description="暂无备注" :image-size="64" />
            <div v-if="detail.actions.canAddNote" class="po-note-form">
              <el-input
                v-model="noteInput"
                type="textarea"
                :rows="3"
                maxlength="2000"
                show-word-limit
                placeholder="输入备注，可多次添加"
              />
              <el-button
                class="po-note-submit"
                type="primary"
                :loading="actionLoading"
                :disabled="!noteInput.trim()"
                @click="onAddNote"
              >
                添加备注
              </el-button>
            </div>
          </section>
        </template>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped src="./pending-orders/pending-orders-pc.css"></style>
<style scoped src="./pending-orders/pending-orders-mobile.css"></style>
<style src="./pending-orders/pending-orders-mobile-drawer.css"></style>
