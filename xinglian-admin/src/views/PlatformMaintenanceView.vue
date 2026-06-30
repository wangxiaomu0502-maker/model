<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Tools } from "@element-plus/icons-vue";

import { fetchAdminSystemSettings, updateAdminSystemSettings } from "@/api/admin";

const loading = ref(true);
const saving = ref(false);
const platformMaintenanceEnabled = ref(false);
const platformMaintenanceMessage = ref("系统维护中，请稍后再试");
const merchantOrderEnabled = ref(true);
const homeStatModelOffset = ref(0);
const homeStatMerchantOffset = ref(0);
const homeStatBrokerOffset = ref(0);
const updatedAt = ref("");

const previewMessage = computed(() => {
  const text = platformMaintenanceMessage.value.trim();
  return text || "系统维护中，请稍后再试";
});

const updatedAtDisplay = computed(() => {
  if (!updatedAt.value) return "尚未保存";
  const d = new Date(updatedAt.value);
  if (Number.isNaN(d.getTime())) return updatedAt.value;
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
    const data = await fetchAdminSystemSettings();
    platformMaintenanceEnabled.value = data.platformMaintenanceEnabled === true;
    platformMaintenanceMessage.value = data.platformMaintenanceMessage || "系统维护中，请稍后再试";
    merchantOrderEnabled.value = data.merchantOrderEnabled !== false;
    homeStatModelOffset.value = Number(data.homeStatModelOffset || 0);
    homeStatMerchantOffset.value = Number(data.homeStatMerchantOffset || 0);
    homeStatBrokerOffset.value = Number(data.homeStatBrokerOffset || 0);
    updatedAt.value = data.updatedAt || "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const data = await updateAdminSystemSettings({
      merchantOrderEnabled: merchantOrderEnabled.value,
      platformMaintenanceEnabled: platformMaintenanceEnabled.value,
      platformMaintenanceMessage: previewMessage.value,
      homeStatModelOffset: Math.trunc(Number(homeStatModelOffset.value || 0)),
      homeStatMerchantOffset: Math.trunc(Number(homeStatMerchantOffset.value || 0)),
      homeStatBrokerOffset: Math.trunc(Number(homeStatBrokerOffset.value || 0))
    });
    platformMaintenanceEnabled.value = data.platformMaintenanceEnabled === true;
    platformMaintenanceMessage.value = data.platformMaintenanceMessage || "系统维护中，请稍后再试";
    updatedAt.value = data.updatedAt || "";
    ElMessage.success(platformMaintenanceEnabled.value ? "已开启维护模式" : "已关闭维护模式");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-icon-wrap">
        <el-icon><Tools /></el-icon>
      </div>
      <div>
        <h1 class="hero-title">平台维护</h1>
        <p class="hero-sub">开启后，小程序用户将看到维护页，无法进入正常使用流程。</p>
      </div>
    </header>

    <div class="layout" v-loading="loading">
      <section class="panel">
        <div class="setting-row">
          <div class="setting-copy">
            <h2 class="setting-title">维护模式</h2>
            <p class="setting-desc">
              开启后小程序启动时会跳转至维护页；运营后台不受影响，可随时关闭恢复。
            </p>
            <p class="setting-meta">最近更新：{{ updatedAtDisplay }}</p>
          </div>
          <el-switch
            v-model="platformMaintenanceEnabled"
            size="large"
            active-text="维护中"
            inactive-text="正常运行"
            :disabled="loading || saving"
          />
        </div>

        <div class="setting-divider"></div>

        <div class="setting-block">
          <div class="setting-copy">
            <h2 class="setting-title">维护提示文案</h2>
            <p class="setting-desc">展示给小程序用户的说明文字，最多 255 字。</p>
          </div>
          <el-input
            v-model="platformMaintenanceMessage"
            type="textarea"
            :rows="4"
            maxlength="255"
            show-word-limit
            placeholder="系统维护中，请稍后再试"
            :disabled="loading || saving"
          />
        </div>

        <div class="actions">
          <el-button :loading="loading" @click="load">刷新</el-button>
          <el-button type="primary" :loading="saving" :disabled="loading" @click="save">
            保存设置
          </el-button>
        </div>
      </section>

      <section class="preview-panel">
        <h2 class="preview-title">小程序预览</h2>
        <p class="preview-sub">用户端实际展示效果</p>
        <div class="phone-frame">
          <div class="phone-screen" :class="{ 'phone-screen--active': platformMaintenanceEnabled }">
            <div class="mini-bg-blob mini-bg-blob-1"></div>
            <div class="mini-bg-blob mini-bg-blob-2"></div>
            <div class="mini-bg-grid"></div>
            <div class="mini-content">
              <div class="mini-icon">🔧</div>
              <div class="mini-title">平台维护中</div>
              <div class="mini-message">{{ previewMessage }}</div>
              <div class="mini-brand">星链模库</div>
            </div>
          </div>
        </div>
        <p class="preview-status">
          当前状态：
          <el-tag :type="platformMaintenanceEnabled ? 'warning' : 'success'" size="small">
            {{ platformMaintenanceEnabled ? "维护中" : "正常运行" }}
          </el-tag>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fff7ed, #f8fafc);
  border: 1px solid rgba(245, 158, 11, 0.18);
}

.hero-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  color: #d97706;
  background: rgba(245, 158, 11, 0.14);
  font-size: 24px;
}

.hero-title {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.hero-sub {
  margin: 6px 0 0;
  color: #64748b;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 18px;
  align-items: start;
}

.panel,
.preview-panel {
  padding: 24px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 40px -30px rgba(15, 23, 42, 0.4);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.setting-copy {
  min-width: 0;
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-divider {
  height: 1px;
  margin: 24px 0;
  background: #e2e8f0;
}

.setting-title {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.setting-desc {
  margin: 8px 0 0;
  color: #475569;
  line-height: 1.7;
}

.setting-meta {
  margin: 10px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.preview-title {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.preview-sub {
  margin: 6px 0 18px;
  color: #64748b;
  font-size: 14px;
}

.phone-frame {
  display: flex;
  justify-content: center;
}

.phone-screen {
  position: relative;
  width: 280px;
  height: 520px;
  overflow: hidden;
  border-radius: 28px;
  border: 8px solid #0f172a;
  background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 42%, #6d28d9 72%, #7c3aed 100%);
  box-shadow: 0 24px 48px -24px rgba(15, 23, 42, 0.45);
}

.phone-screen:not(.phone-screen--active) {
  opacity: 0.72;
}

.mini-bg-blob,
.mini-bg-grid {
  position: absolute;
  pointer-events: none;
}

.mini-bg-blob-1 {
  width: 180px;
  height: 180px;
  top: -60px;
  right: -40px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.24) 0%, transparent 65%);
}

.mini-bg-blob-2 {
  width: 140px;
  height: 140px;
  bottom: -30px;
  left: -30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.14) 0%, transparent 68%);
}

.mini-bg-grid {
  inset: 0;
  opacity: 0.08;
  background-image: linear-gradient(rgba(255, 255, 255, 0.92) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.92) 1px, transparent 1px);
  background-size: 24px 24px;
}

.mini-content {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 48px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.mini-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.mini-title {
  margin-top: 24px;
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.96);
}

.mini-message {
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.86);
}

.mini-brand {
  margin-top: auto;
  font-size: 12px;
  letter-spacing: 0.28em;
  color: rgba(255, 255, 255, 0.45);
}

.preview-status {
  margin: 18px 0 0;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .setting-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .actions {
    justify-content: flex-start;
  }
}
</style>
