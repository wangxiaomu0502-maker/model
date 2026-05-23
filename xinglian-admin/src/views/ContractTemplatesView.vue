<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { QuillEditor } from "@vueup/vue-quill";
import {
  Connection,
  Document,
  OfficeBuilding,
  Shop,
  UserFilled
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import "quill/dist/quill.snow.css";

import {
  fetchAdminContractTemplates,
  updateAdminContractTemplate,
  type AdminContractKind,
  type AdminContractTemplateItem
} from "@/api/admin";

const KIND_VISUAL: Record<
  AdminContractKind,
  { icon: typeof Shop; iconClass: string }
> = {
  platform_broker: { icon: Connection, iconClass: "kind-card-icon--broker" },
  platform_merchant: { icon: Shop, iconClass: "kind-card-icon--merchant" },
  broker_model: { icon: UserFilled, iconClass: "kind-card-icon--model" },
  platform_agent: { icon: OfficeBuilding, iconClass: "kind-card-icon--agent" }
};

const loading = ref(true);
const saving = ref(false);
const list = ref<AdminContractTemplateItem[]>([]);
const selectedKind = ref<AdminContractKind>("platform_broker");
const editorTitle = ref("");
const editorHtml = ref("<p><br></p>");

const toolbarOptions: unknown[] = [
  ["bold", "italic", "underline", "strike"],
  [{ header: 1 }, { header: 2 }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["link"],
  ["clean"]
];

const currentRow = computed(() =>
  list.value.find((x) => x.contractKind === selectedKind.value)
);

function applyRowToEditor(row: AdminContractTemplateItem | undefined): void {
  if (!row) return;
  editorTitle.value = row.title ?? "";
  const html = row.contentHtml?.trim() ? row.contentHtml : "<p><br></p>";
  editorHtml.value = html;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const items = await fetchAdminContractTemplates();
    list.value = items;
    const row =
      items.find((x) => x.contractKind === selectedKind.value) ?? items[0];
    if (row && selectedKind.value !== row.contractKind) {
      selectedKind.value = row.contractKind;
    }
    applyRowToEditor(row ?? items[0]);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

watch(selectedKind, (k) => {
  const row = list.value.find((x) => x.contractKind === k);
  void nextTick(() => applyRowToEditor(row));
});

function selectKind(k: AdminContractKind): void {
  selectedKind.value = k;
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const updated = await updateAdminContractTemplate(selectedKind.value, {
      title: editorTitle.value.trim(),
      contentHtml: editorHtml.value || ""
    });
    const idx = list.value.findIndex((x) => x.contractKind === updated.contractKind);
    if (idx >= 0) list.value[idx] = updated;
    else list.value.push(updated);
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

const updatedAtDisplay = computed(() => {
  const u = currentRow.value?.updatedAt;
  if (!u) return "—";
  const d = new Date(u);
  return Number.isNaN(d.getTime())
    ? u
    : d.toLocaleString("zh-CN", { hour12: false });
});

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-visual" aria-hidden="true">
        <el-icon class="hero-icon"><Document /></el-icon>
      </div>
      <div class="hero-text">
        <h1 class="hero-title">合同管理</h1>
      </div>
    </header>

    <div v-loading="loading" class="panels">
      <section class="panel panel-kinds" aria-label="选择合同类型">
        <div class="panel-head">
          <h2 class="panel-title">合同类型</h2>
        </div>
        <div class="kind-cards">
          <button
            v-for="row in list"
            :key="row.contractKind"
            type="button"
            class="kind-card"
            :class="{ 'kind-card--active': selectedKind === row.contractKind }"
            @click="selectKind(row.contractKind)"
          >
            <div
              class="kind-card-icon"
              :class="KIND_VISUAL[row.contractKind].iconClass"
            >
              <el-icon class="kind-card-elicon">
                <component :is="KIND_VISUAL[row.contractKind].icon" />
              </el-icon>
            </div>
            <span class="kind-card-label">{{ row.label }}</span>
            <span class="kind-card-sub">{{ row.partiesLine }}</span>
          </button>
        </div>
      </section>

      <section class="panel panel-editor">
        <div class="panel-head panel-head--editor">
          <div class="panel-editor-intro">
            <h2 class="panel-title">正文编辑</h2>
            <p v-if="currentRow?.partiesLine" class="panel-sub">{{ currentRow.partiesLine }}</p>
            <div class="panel-editor-saved" aria-label="最近保存时间">
              <span class="panel-editor-saved-label">最近保存</span>
              <span class="panel-editor-saved-value">{{ updatedAtDisplay }}</span>
            </div>
          </div>
          <el-button
            type="primary"
            size="large"
            round
            class="save-btn panel-editor-save"
            :loading="saving"
            @click="onSave"
          >
            保存当前合同
          </el-button>
        </div>

        <el-form label-position="top" class="form" @submit.prevent>
          <el-form-item label="合同标题">
            <el-input
              v-model="editorTitle"
              maxlength="200"
              show-word-limit
              placeholder="对用户端展示的标题"
              size="large"
              class="title-input"
            />
          </el-form-item>

          <el-form-item label="正文" class="form-item-editor">
            <div class="editor-shell">
              <QuillEditor
                :key="selectedKind"
                v-model:content="editorHtml"
                content-type="html"
                theme="snow"
                :toolbar="toolbarOptions"
                placeholder="请输入合同正文，支持标题、列表、加粗、链接等……"
                class="quill"
                style="height: 100%; min-height: 0"
              />
            </div>
          </el-form-item>
        </el-form>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 整页强制中文优先字体栈，避免 Quill 默认 Helvetica 导致中文怪异或「像乱码」 */
.page {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  font-family:
    "PingFang SC",
    "Microsoft YaHei",
    system-ui,
    -apple-system,
    "Plus Jakarta Sans",
    sans-serif;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px 20px;
  margin-bottom: 16px;
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
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 160px;
}

.panel {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  padding: 18px 20px 20px;
}

.panel.panel-editor {
  display: flex;
  flex-direction: column;
  /* 给表单纵向 flex 链一个明确高度预算，否则正文项 flex:1 无法拉高编辑器 */
  min-height: clamp(640px, 78vh, 1040px);
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 14px;
}

.panel-head--editor {
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 12px;
}

.panel-editor-intro {
  flex: 1;
  min-width: min(100%, 220px);
}

.panel-editor-saved {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-top: 10px;
}

.panel-editor-saved-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
}

.panel-editor-saved-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.panel-editor-save {
  flex-shrink: 0;
  align-self: flex-start;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.panel-sub {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  line-height: 1.45;
}

.kind-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .kind-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .kind-cards {
    grid-template-columns: 1fr;
  }
}

.kind-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.85);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
  font: inherit;
  color: inherit;
}

.kind-card:hover {
  border-color: rgba(99, 102, 241, 0.28);
  box-shadow: 0 8px 22px -14px rgba(79, 70, 229, 0.35);
  transform: translateY(-1px);
}

.kind-card:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.55);
  outline-offset: 2px;
}

.kind-card--active {
  border-color: rgba(99, 102, 241, 0.55);
  background: rgba(99, 102, 241, 0.06);
  box-shadow: 0 6px 20px -12px rgba(79, 70, 229, 0.45);
}

.kind-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kind-card-icon--broker {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.kind-card-icon--merchant {
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
}

.kind-card-icon--model {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.kind-card-icon--agent {
  background: rgba(245, 158, 11, 0.14);
  color: #d97706;
}

.kind-card-elicon {
  font-size: 20px;
}

.kind-card-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.kind-card-sub {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  color: #64748b;
}

.form {
  max-width: 100%;
}

.panel-editor .form {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
}

.panel-editor .form-item-editor {
  flex: 1 1 auto;
  min-height: 0;
}

.title-input {
  max-width: min(560px, 100%);
}

.form-item-editor :deep(.el-form-item__content) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/**
 * Quill Snow（@vueup/vue-quill）：根节点即挂载容器；主题里 .ql-container、.ql-editor 默认 height:100%。
 * 高度要么给 .ql-container 写死/min（官网示例常见），要么祖先有确定高度再走 height:100%。
 * Snow 主题里 .ql-container 默认 height:100%，但与工具栏并排时会当成「整棵 .quill 的高度」，必须改为 flex:1 + height:auto，剩余高度再给 .ql-editor: height:100%。
 */
.editor-shell {
  --contract-quill-body-min: clamp(420px, 56vh, 820px);
  width: 100%;
  flex: 0 0 auto;
  height: var(--contract-quill-body-min);
  min-height: var(--contract-quill-body-min);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.98);
  overflow: hidden;
  background: #fafbfc;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.quill {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* Quill：/editor/toolbar 全部走中文字体，覆盖 Snow 主题默认 Helvetica */
.quill :deep(.ql-editor),
.quill :deep(.ql-toolbar),
.quill :deep(.ql-toolbar .ql-picker-label),
.quill :deep(.ql-toolbar button),
.quill :deep(.ql-tooltip) {
  font-family:
    "PingFang SC",
    "Microsoft YaHei",
    system-ui,
    -apple-system,
    sans-serif !important;
}

.quill :deep(.ql-container) {
  flex: 1 1 auto;
  min-height: var(--contract-quill-body-min);
  width: 100%;
  border: none;
  font-size: 15px;
  overflow: hidden;
  /* 覆盖主题 height:100%，并给正文稳定高度预算 */
  height: auto !important;
  display: flex;
  flex-direction: column;
}

.quill :deep(.ql-editor) {
  flex: 1 1 auto;
  min-height: var(--contract-quill-body-min);
  height: auto;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.65;
  color: var(--el-text-color-primary);
}

.quill :deep(.ql-editor.ql-blank::before) {
  font-style: normal;
  color: #94a3b8;
}

.quill :deep(.ql-toolbar) {
  flex-shrink: 0;
  border: none;
  border-bottom: 1px solid rgba(226, 232, 240, 0.98);
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.92);
}

.save-btn {
  min-width: 148px;
  font-weight: 700;
}

.panel-editor-save:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

:deep(.form .el-form-item__label) {
  font-weight: 700;
}
</style>
