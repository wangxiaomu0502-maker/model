<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Connection,
  Document,
  Headset,
  List,
  Money,
  Odometer,
  PieChart,
  Setting,
  Shop,
  SwitchButton,
  UploadFilled,
  UserFilled
} from "@element-plus/icons-vue";

import adminLogo from "@/assets/admin-logo.png";

import { clearAdminSession, getAdminProfile, getAdminRole } from "@/composables/useAdminToken";

const route = useRoute();
const router = useRouter();
const activeMenu = computed(() => {
  const p = route.path;
  if (p === "/orders" || p.startsWith("/orders/")) return "/orders";
  if (p === "/platform-billing" || p.startsWith("/platform-billing")) return "/platform-billing";
  if (p === "/pending-orders" || p.startsWith("/pending-orders")) return "/pending-orders";
  if (p === "/cs-users" || p.startsWith("/cs-users")) return "/cs-users";
  if (p === "/image-upload" || p.startsWith("/image-upload")) return "/image-upload";
  if (p === "/system-settings" || p.startsWith("/system-settings")) return "/system-settings";
  return p;
});

const isCs = computed(() => getAdminRole() === "cs");

/** 待处理订单页在移动端隐藏侧栏，便于客服全屏处理 */
const isPendingOrdersRoute = computed(() => {
  const p = route.path;
  return p === "/pending-orders" || p.startsWith("/pending-orders/");
});

const homePath = computed(() => (isCs.value ? "/pending-orders" : "/dashboard"));

const displayLine = computed(() => {
  const p = getAdminProfile();
  if (!p) return "";
  const name = p.displayName || p.username;
  return isCs.value ? `${name}（客服）` : name;
});

function logout(): void {
  clearAdminSession();
  window.dispatchEvent(new CustomEvent("admin-token-changed"));
  void router.replace({ name: "login" });
}
</script>

<template>
  <el-container class="admin-root">
    <el-header class="admin-header" height="60px">
      <div class="header-left">
        <router-link :to="homePath" class="brand-link">
          <img class="brand-logo-sm" :src="adminLogo" alt="" />
          <div class="brand-text">
            <span class="brand-title">星链</span>
            <span class="brand-sub">运营后台</span>
          </div>
        </router-link>
      </div>
      <div class="header-right">
        <div v-if="displayLine" class="user-pill">
          <span class="user-dot" aria-hidden="true" />
          <span class="user-name">{{ displayLine }}</span>
        </div>
        <el-button class="logout-btn" round size="small" @click="logout">
          <el-icon class="logout-icon"><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </el-header>
    <el-container
      class="admin-body"
      :class="{ 'admin-body--pending-mobile': isPendingOrdersRoute }"
    >
      <el-aside class="admin-aside" width="216px">
        <nav class="aside-inner" aria-label="主导航">
          <el-menu
            :key="`${route.path}-${isCs}`"
            class="admin-menu"
            :router="true"
            :default-active="activeMenu"
          >
            <template v-if="isCs">
              <el-menu-item index="/pending-orders">
                <el-icon><List /></el-icon>
                <span>待处理订单</span>
              </el-menu-item>
            </template>
            <template v-else>
              <el-menu-item index="/dashboard">
                <el-icon><Odometer /></el-icon>
                <span>工作台</span>
              </el-menu-item>
              <el-menu-item index="/models">
                <el-icon><UserFilled /></el-icon>
                <span>模特列表</span>
              </el-menu-item>
              <el-menu-item index="/merchants">
                <el-icon><Shop /></el-icon>
                <span>商家列表</span>
              </el-menu-item>
              <el-menu-item index="/broker-users">
                <el-icon><Connection /></el-icon>
                <span>经纪人列表</span>
              </el-menu-item>
              <el-menu-item index="/agents">
                <el-icon><UserFilled /></el-icon>
                <span>代理人列表</span>
              </el-menu-item>
              <el-menu-item index="/orders">
                <el-icon><List /></el-icon>
                <span>订单列表</span>
              </el-menu-item>
              <el-menu-item index="/platform-billing">
                <el-icon><Money /></el-icon>
                <span>平台看板</span>
              </el-menu-item>
              <el-menu-item index="/split-rules">
                <el-icon><PieChart /></el-icon>
                <span>分账配置</span>
              </el-menu-item>
              <el-menu-item index="/contract-templates">
                <el-icon><Document /></el-icon>
                <span>合同管理</span>
              </el-menu-item>
              <el-menu-item index="/image-upload">
                <el-icon><UploadFilled /></el-icon>
                <span>图片上传</span>
              </el-menu-item>
              <el-menu-item index="/cs-users">
                <el-icon><Headset /></el-icon>
                <span>客服管理</span>
              </el-menu-item>
              <el-menu-item index="/pending-orders">
                <el-icon><List /></el-icon>
                <span>待客服处理订单</span>
              </el-menu-item>
              <el-menu-item index="/system-settings">
                <el-icon><Setting /></el-icon>
                <span>系统管理</span>
              </el-menu-item>
            </template>
          </el-menu>
        </nav>
      </el-aside>
      <el-main class="admin-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <div :key="route.fullPath" class="admin-route-view">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-root {
  --admin-shell-accent: #6366f1;
  --admin-aside-bg: #f8fafc;
  --admin-aside-border: #e2e8f0;

  min-height: 100vh;
  flex-direction: column;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px 0 18px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 4px 24px -8px rgba(15, 23, 42, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  border-radius: 12px;
  padding: 6px 8px 6px 6px;
  margin-left: -6px;
  transition: background 0.2s ease;
}

.brand-link:hover {
  background: rgba(99, 102, 241, 0.06);
}

.brand-logo-sm {
  height: 36px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  border-radius: 10px;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 12px rgba(15, 23, 42, 0.12));
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.15;
  min-width: 0;
}

.brand-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.brand-sub {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.user-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.65));
  border: 1px solid rgba(148, 163, 184, 0.25);
  max-width: 240px;
}

.user-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(145deg, #34d399, #059669);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.35);
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  font-weight: 600;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.9);
  color: var(--el-text-color-regular);
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.logout-btn:hover {
  border-color: rgba(239, 68, 68, 0.45);
  color: #dc2626;
  box-shadow: 0 4px 14px -6px rgba(239, 68, 68, 0.35);
}

.logout-icon {
  margin-right: 4px;
  vertical-align: middle;
}

.admin-body {
  flex: 1;
  min-height: 0;
}

.admin-aside {
  flex-shrink: 0;
  background: var(--admin-aside-bg);
  border-right: 1px solid var(--admin-aside-border);
}

.aside-inner {
  padding: 10px 8px 16px;
  height: 100%;
}

.admin-menu {
  border-right: none !important;
  background: transparent !important;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #64748b;
  --el-menu-hover-text-color: #0f172a;
  --el-menu-active-color: #4f46e5;
  --el-menu-hover-bg-color: rgba(241, 245, 249, 0.9);
}

.admin-menu :deep(.el-menu-item),
.admin-menu :deep(.el-sub-menu__title) {
  border-radius: 8px;
  margin: 2px 6px;
  height: 40px;
  line-height: 40px;
  padding: 0 12px !important;
  font-weight: 400;
  font-size: 14px;
}

.admin-menu :deep(.el-menu-item .el-icon) {
  font-size: 17px;
  margin-right: 8px;
  color: #94a3b8;
}

.admin-menu :deep(.el-menu-item:hover .el-icon) {
  color: #64748b;
}

.admin-menu :deep(.el-menu-item:hover) {
  background-color: var(--el-menu-hover-bg-color) !important;
}

.admin-menu :deep(.el-menu-item.is-active) {
  background-color: rgba(99, 102, 241, 0.08) !important;
  color: #4338ca !important;
  font-weight: 600;
  box-shadow: inset 2px 0 0 0 var(--admin-shell-accent);
}

.admin-menu :deep(.el-menu-item.is-active .el-icon) {
  color: var(--admin-shell-accent);
}

.admin-main {
  padding: 22px 24px 28px;
  background: linear-gradient(180deg, var(--el-fill-color-light) 0%, #eef2f7 100%);
  overflow: auto;
}

.admin-route-view {
  min-height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 待处理订单：移动端全宽内容区，不展示左侧菜单 */
@media (max-width: 768px) {
  .admin-body--pending-mobile .admin-aside {
    display: none;
  }

  .admin-body--pending-mobile .admin-main {
    padding: 0;
    background: #eef2f7;
    overflow-x: hidden;
  }

  .admin-body--pending-mobile .admin-header {
    padding: 0 12px;
  }

  .admin-body--pending-mobile .brand-sub {
    display: none;
  }

  .admin-body--pending-mobile .user-pill {
    max-width: 120px;
  }
}
</style>
