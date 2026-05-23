<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Lock, User } from "@element-plus/icons-vue";

import adminLogo from "@/assets/admin-logo.png";

import { loginAdmin } from "@/api/admin";
import { setAdminProfile, setAdminToken } from "@/composables/useAdminToken";

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const loginType = ref<"admin" | "cs">("admin");
const form = reactive({
  username: "",
  password: ""
});

async function onSubmit(): Promise<void> {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning("请输入账号和密码");
    return;
  }
  loading.value = true;
  try {
    const data = await loginAdmin(form.username.trim(), form.password, loginType.value);
    setAdminToken(data.token);
    setAdminProfile(data.admin);
    ElMessage.success("登录成功");
    window.dispatchEvent(new CustomEvent("admin-token-changed"));
    const defaultPath = data.admin.role === "cs" ? "/pending-orders" : "/dashboard";
    const redirect = (route.query.redirect as string) || defaultPath;
    await router.replace(redirect);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
      <div class="blob blob-4" />
      <div class="grain" />
      <div class="vignette" />
    </div>

    <div class="login-shell">
      <section class="brand-panel">
        <div class="brand-panel-decor" aria-hidden="true" />
        <div class="brand-panel-shine" aria-hidden="true" />

        <div class="brand-logo-wrap">
          <img class="brand-logo" :src="adminLogo" alt="MODEL WORLD FASHION · 星链运营后台" />
        </div>

        <p class="brand-kicker">XINGLIAN ADMIN</p>
        <h1 class="brand-title">星链</h1>
        <p class="brand-subtitle">运营控制台</p>
        <p class="brand-desc">统一管理模特、商家与经纪人，业务数据与小程序用户体系分离。</p>
        <ul class="brand-tags">
          <li>权限隔离</li>
          <li>审计友好</li>
          <li>持续迭代</li>
        </ul>
      </section>

      <section class="form-panel">
        <header class="form-header">
          <h2 class="form-title">欢迎回来</h2>
          <p class="form-lead">
            {{ loginType === "admin" ? "使用管理员账号登录以继续操作" : "使用客服账号登录处理订单" }}
          </p>
        </header>

        <el-tabs v-model="loginType" class="login-tabs" stretch>
          <el-tab-pane label="管理员登录" name="admin" />
          <el-tab-pane label="客服登录" name="cs" />
        </el-tabs>

        <el-form class="login-form" label-position="top" size="large" @submit.prevent>
          <el-form-item label="账号">
            <el-input
              v-model="form.username"
              autocomplete="username"
              :placeholder="loginType === 'admin' ? '管理员账号' : '客服账号'"
              clearable
            >
              <template #prefix>
                <el-icon class="input-affix"><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              autocomplete="current-password"
              placeholder="请输入密码"
              @keyup.enter="onSubmit"
            >
              <template #prefix>
                <el-icon class="input-affix"><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-button class="submit-btn" type="primary" size="large" round :loading="loading" @click="onSubmit">
            登录
          </el-button>
        </el-form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  --login-accent: #4f46e5;
  --login-accent-2: #6366f1;
  --login-accent-soft: rgba(79, 70, 229, 0.14);
  --login-slate: #0f172a;
  --login-muted: #64748b;

  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 4vw, 40px);
  overflow-x: hidden;
  font-family:
    "Plus Jakarta Sans",
    system-ui,
    -apple-system,
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;
  background: radial-gradient(ellipse 120% 80% at 50% -20%, #e8eef9 0%, #eef2f7 38%, #e2e8f0 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(76px);
  opacity: 0.52;
  animation: float 22s ease-in-out infinite;
}

.blob-1 {
  width: min(52vw, 440px);
  height: min(52vw, 440px);
  top: -14%;
  left: -10%;
  background: radial-gradient(circle at 32% 28%, #ddd6fe, #818cf8 46%, transparent 72%);
  animation-delay: 0s;
}

.blob-2 {
  width: min(50vw, 400px);
  height: min(50vw, 400px);
  bottom: -16%;
  right: -8%;
  background: radial-gradient(circle at 72% 38%, #bae6fd, #6366f1 52%, transparent 74%);
  animation-delay: -7s;
}

.blob-3 {
  width: min(38vw, 300px);
  height: min(38vw, 300px);
  top: 48%;
  left: 36%;
  background: radial-gradient(circle at 50% 50%, #fef3c7, #f472b6 44%, transparent 70%);
  opacity: 0.34;
  animation-delay: -13s;
}

.blob-4 {
  width: min(28vw, 220px);
  height: min(28vw, 220px);
  top: 12%;
  right: 18%;
  background: radial-gradient(circle at 50% 50%, #a7f3d0, var(--login-accent-2) 48%, transparent 72%);
  opacity: 0.28;
  animation-delay: -4s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(2%, -3%) scale(1.035);
  }
  66% {
    transform: translate(-3%, 2%) scale(0.975);
  }
}

.grain {
  position: absolute;
  inset: 0;
  opacity: 0.038;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 85% 70% at 50% 50%, transparent 40%, rgba(15, 23, 42, 0.06) 100%);
}

.login-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: 1fr;
  border-radius: 28px;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 250, 252, 0.74) 100%);
  backdrop-filter: blur(28px) saturate(1.35);
  -webkit-backdrop-filter: blur(28px) saturate(1.35);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.92) inset,
    0 0 0 1px rgba(255, 255, 255, 0.55) inset,
    0 32px 64px -16px rgba(15, 23, 42, 0.2),
    0 16px 40px -12px rgba(79, 70, 229, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.72);
  animation: shell-in 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes shell-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (min-width: 840px) {
  .login-shell {
    grid-template-columns: minmax(268px, 1fr) minmax(328px, 1.08fr);
    min-height: 436px;
  }
}

.brand-panel {
  position: relative;
  padding: clamp(28px, 5vw, 48px);
  background:
    linear-gradient(155deg, var(--login-slate) 0%, #172554 38%, #312e81 72%, #1e1b4b 100%);
  color: #f8fafc;
}

.brand-panel-decor {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(165deg, rgba(0, 0, 0, 0.95) 15%, rgba(0, 0, 0, 0.35) 55%, transparent 92%);
  pointer-events: none;
}

.brand-panel-shine {
  position: absolute;
  inset: -40% -20% auto -30%;
  height: 85%;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 42%,
    transparent 58%
  );
  transform: rotate(-8deg);
  pointer-events: none;
}

.brand-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 55% at 15% 88%, rgba(99, 102, 241, 0.42), transparent 58%),
    radial-gradient(ellipse 60% 45% at 92% 12%, rgba(56, 189, 248, 0.18), transparent 52%);
  pointer-events: none;
}

.brand-logo-wrap,
.brand-kicker,
.brand-title,
.brand-subtitle,
.brand-desc,
.brand-tags {
  position: relative;
  z-index: 1;
}

.brand-logo-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 22px;
}

.brand-logo {
  display: block;
  height: clamp(52px, 11vw, 82px);
  width: auto;
  max-width: min(100%, 260px);
  object-fit: contain;
  object-position: left center;
  border-radius: 14px;
  filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.45))
    drop-shadow(0 0 24px rgba(212, 175, 105, 0.12));
}

.brand-kicker {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: 0.24em;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.68);
}

.brand-title {
  margin: 0;
  font-size: clamp(30px, 4.2vw, 38px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.12;
  background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 85%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 1px 0 rgba(15, 23, 42, 0.15);
}

.brand-subtitle {
  margin: 8px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.9);
  letter-spacing: 0.02em;
}

.brand-desc {
  margin: 22px 0 0;
  font-size: 13px;
  line-height: 1.68;
  color: rgba(203, 213, 225, 0.9);
  max-width: 318px;
}

.brand-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}

.brand-tags li {
  font-size: 12px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(248, 250, 252, 0.92);
  backdrop-filter: blur(8px);
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease;
}

.brand-tags li:hover {
  transform: translateY(-2px);
  border-color: rgba(165, 180, 252, 0.45);
  background: rgba(255, 255, 255, 0.11);
}

.form-panel {
  position: relative;
  padding: clamp(28px, 5vw, 48px) clamp(24px, 5vw, 52px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(248, 250, 252, 0.52) 100%);
}

.form-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 45% at 85% 8%, rgba(79, 70, 229, 0.06), transparent 65%);
  pointer-events: none;
}

@media (min-width: 840px) {
  .form-panel {
    border-left: 1px solid rgba(148, 163, 184, 0.18);
  }
}

.login-tabs {
  margin-bottom: 8px;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 18px;
}

.form-header {
  position: relative;
  margin-bottom: 26px;
}

.form-title {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  color: var(--login-slate);
  letter-spacing: -0.03em;
}

.form-lead {
  margin: 10px 0 0;
  font-size: 14px;
  color: var(--login-muted);
  line-height: 1.55;
  font-weight: 500;
}

.login-form {
  position: relative;
  z-index: 1;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px !important;
}

.input-affix {
  font-size: 18px;
  color: #94a3b8;
  transition: color 0.2s ease;
}

.login-form :deep(.el-input__wrapper.is-focus) .input-affix {
  color: var(--login-accent);
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 14px;
  padding-left: 14px;
  min-height: 46px;
  background-color: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.28) inset,
    0 2px 8px -4px rgba(15, 23, 42, 0.08);
  transition:
    box-shadow 0.22s ease,
    background 0.22s ease,
    transform 0.22s ease;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow:
    0 0 0 1px rgba(99, 102, 241, 0.38) inset,
    0 6px 16px -8px rgba(79, 70, 229, 0.22);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 2px var(--login-accent-soft),
    0 0 0 1px var(--login-accent) inset,
    0 8px 22px -10px rgba(79, 70, 229, 0.35);
  background-color: #fff;
}

.submit-btn {
  width: 100%;
  margin-top: 10px;
  height: 48px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, var(--login-accent) 48%, #4338ca 100%);
  box-shadow:
    0 12px 28px -10px rgba(79, 70, 229, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.submit-btn:hover:not(.is-disabled) {
  transform: translateY(-2px);
  filter: brightness(1.04);
  box-shadow:
    0 18px 36px -12px rgba(79, 70, 229, 0.72),
    0 0 0 1px rgba(255, 255, 255, 0.18) inset;
}

.submit-btn:active:not(.is-disabled) {
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .login-shell {
    animation: none !important;
  }

  .brand-tags li:hover {
    transform: none;
  }

  .submit-btn:hover:not(.is-disabled) {
    transform: none;
  }
}

@media (max-width: 839px) {
  .brand-panel {
    text-align: center;
  }

  .brand-logo-wrap {
    justify-content: center;
  }

  .brand-logo {
    object-position: center center;
  }

  .brand-desc {
    margin-left: auto;
    margin-right: auto;
  }

  .brand-tags {
    justify-content: center;
  }

  .form-panel {
    border-top: 1px solid rgba(148, 163, 184, 0.18);
  }

  .form-header {
    text-align: center;
  }
}
</style>
