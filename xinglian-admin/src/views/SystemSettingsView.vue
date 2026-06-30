<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Setting } from "@element-plus/icons-vue";

import { fetchAdminSystemSettings, updateAdminSystemSettings } from "@/api/admin";

const loading = ref(true);
const saving = ref(false);
const merchantOrderEnabled = ref(true);
const platformMaintenanceEnabled = ref(false);
const platformMaintenanceMessage = ref("系统维护中，请稍后再试");
const homeStatModelOffset = ref(0);
const homeStatMerchantOffset = ref(0);
const homeStatBrokerOffset = ref(0);
const updatedAt = ref("");

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
    merchantOrderEnabled.value = data.merchantOrderEnabled !== false;
    platformMaintenanceEnabled.value = data.platformMaintenanceEnabled === true;
    platformMaintenanceMessage.value = data.platformMaintenanceMessage || "系统维护中，请稍后再试";
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
      platformMaintenanceMessage: platformMaintenanceMessage.value.trim() || "系统维护中，请稍后再试",
      homeStatModelOffset: Math.trunc(Number(homeStatModelOffset.value || 0)),
      homeStatMerchantOffset: Math.trunc(Number(homeStatMerchantOffset.value || 0)),
      homeStatBrokerOffset: Math.trunc(Number(homeStatBrokerOffset.value || 0))
    });
    merchantOrderEnabled.value = data.merchantOrderEnabled !== false;
    platformMaintenanceEnabled.value = data.platformMaintenanceEnabled === true;
    platformMaintenanceMessage.value = data.platformMaintenanceMessage || "系统维护中，请稍后再试";
    homeStatModelOffset.value = Number(data.homeStatModelOffset || 0);
    homeStatMerchantOffset.value = Number(data.homeStatMerchantOffset || 0);
    homeStatBrokerOffset.value = Number(data.homeStatBrokerOffset || 0);
    updatedAt.value = data.updatedAt || "";
    ElMessage.success("已保存");
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
        <el-icon><Setting /></el-icon>
      </div>
      <div>
        <h1 class="hero-title">系统管理</h1>
        <p class="hero-sub">控制平台级功能开关与首页展示数据。</p>
      </div>
    </header>

    <section class="panel" v-loading="loading">
      <div class="setting-row">
        <div class="setting-copy">
          <h2 class="setting-title">允许商家下单</h2>
          <p class="setting-desc">
            关闭后，小程序端商家点击下单会提示“目前不允许商家下单”，服务端也会阻止新订单创建。
          </p>
          <p class="setting-meta">最近更新：{{ updatedAtDisplay }}</p>
        </div>
        <el-switch
          v-model="merchantOrderEnabled"
          size="large"
          active-text="开启"
          inactive-text="关闭"
          :disabled="loading || saving"
        />
      </div>

      <div class="setting-divider"></div>

      <div class="setting-block">
        <div class="setting-copy">
          <h2 class="setting-title">首页统计数据修正</h2>
          <p class="setting-desc">
            小程序首页展示数 = 真实注册数 + 修正数；支持负数，最终展示不会低于 0。
          </p>
        </div>

        <div class="offset-grid">
          <label class="offset-item">
            <span class="offset-label">模特修正数</span>
            <el-input-number
              v-model="homeStatModelOffset"
              :step="1"
              step-strictly
              :disabled="loading || saving"
              controls-position="right"
            />
          </label>
          <label class="offset-item">
            <span class="offset-label">客户修正数</span>
            <el-input-number
              v-model="homeStatMerchantOffset"
              :step="1"
              step-strictly
              :disabled="loading || saving"
              controls-position="right"
            />
          </label>
          <label class="offset-item">
            <span class="offset-label">经纪人修正数</span>
            <el-input-number
              v-model="homeStatBrokerOffset"
              :step="1"
              step-strictly
              :disabled="loading || saving"
              controls-position="right"
            />
          </label>
        </div>
      </div>

      <div class="actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :loading="saving" :disabled="loading" @click="save">
          保存设置
        </el-button>
      </div>
    </section>
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
  background: linear-gradient(135deg, #eef2ff, #f8fafc);
  border: 1px solid rgba(99, 102, 241, 0.14);
}

.hero-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.12);
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

.panel {
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
  gap: 18px;
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

.offset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.offset-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.offset-label {
  font-size: 14px;
  color: #334155;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

@media (max-width: 720px) {
  .setting-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .actions {
    justify-content: flex-start;
  }

  .offset-grid {
    grid-template-columns: 1fr;
  }
}
</style>
