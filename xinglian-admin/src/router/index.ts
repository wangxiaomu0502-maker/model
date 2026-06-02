import { createRouter, createWebHistory } from "vue-router";

import AdminLayout from "@/layouts/AdminLayout.vue";
import { getAdminRole, getAdminToken } from "@/composables/useAdminToken";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { title: "登录", public: true }
    },
    {
      path: "/",
      component: AdminLayout,
      redirect: "/dashboard",
      children: [
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("@/views/DashboardView.vue"),
          meta: { title: "工作台" }
        },
        {
          path: "models",
          name: "models",
          component: () => import("@/views/RoleUserListView.vue"),
          meta: { title: "模特列表", listKind: "models" as const }
        },
        {
          path: "merchants",
          name: "merchants",
          component: () => import("@/views/RoleUserListView.vue"),
          meta: { title: "商家列表", listKind: "merchants" as const }
        },
        {
          path: "broker-users",
          name: "broker-users",
          component: () => import("@/views/RoleUserListView.vue"),
          meta: { title: "经纪人列表", listKind: "brokers" as const }
        },
        {
          path: "agents",
          name: "agents",
          component: () => import("@/views/AgentListView.vue"),
          meta: { title: "代理人列表" }
        },
        {
          path: "orders",
          component: () => import("@/views/OrdersShell.vue"),
          children: [
            {
              path: "",
              name: "orders",
              component: () => import("@/views/OrderListView.vue"),
              meta: { title: "订单列表" }
            },
            {
              path: ":orderId",
              name: "order-detail",
              component: () => import("@/views/OrderDetailView.vue"),
              meta: { title: "订单详情" }
            }
          ]
        },
        {
          path: "platform-billing",
          name: "platform-billing",
          component: () => import("@/views/PlatformBillingView.vue"),
          meta: { title: "平台看板" }
        },
        {
          path: "platform-ledger",
          name: "platform-ledger",
          component: () => import("@/views/PlatformLedgerView.vue"),
          meta: { title: "平台流水" }
        },
        {
          path: "split-rules",
          name: "split-rules",
          component: () => import("@/views/SplitRulesView.vue"),
          meta: { title: "分账配置" }
        },
        {
          path: "contract-templates",
          name: "contract-templates",
          component: () => import("@/views/ContractTemplatesView.vue"),
          meta: { title: "合同管理" }
        },
        {
          path: "image-upload",
          name: "image-upload",
          component: () => import("@/views/ImageUploadView.vue"),
          meta: { title: "图片上传", adminOnly: true }
        },
        {
          path: "cs-users",
          name: "cs-users",
          component: () => import("@/views/CsUserListView.vue"),
          meta: { title: "客服管理", adminOnly: true }
        },
        {
          path: "pending-orders",
          name: "pending-orders",
          component: () => import("@/views/PendingOrdersView.vue"),
          meta: { title: "待处理订单" }
        },
        {
          path: "system-settings",
          name: "system-settings",
          component: () => import("@/views/SystemSettingsView.vue"),
          meta: { title: "系统管理", adminOnly: true }
        }
      ]
    }
  ]
});

const CS_HOME = "/pending-orders";
const ADMIN_HOME = "/dashboard";

router.beforeEach((to) => {
  const token = getAdminToken();
  const role = getAdminRole();

  if (to.meta.public === true) {
    if (to.name === "login" && token) {
      return { path: role === "cs" ? CS_HOME : ADMIN_HOME };
    }
    return true;
  }

  if (!token) {
    if (to.fullPath === "/" || to.fullPath === "") {
      return { name: "login" };
    }
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.path === "/" || to.path === "") {
    return { path: role === "cs" ? CS_HOME : ADMIN_HOME };
  }

  if (to.meta.adminOnly === true && role !== "admin") {
    return { path: role === "cs" ? CS_HOME : ADMIN_HOME };
  }

  if (role === "cs") {
    const allowed =
      to.path === CS_HOME ||
      to.path.startsWith(`${CS_HOME}/`) ||
      to.name === "pending-orders";
    if (!allowed) {
      return { path: CS_HOME };
    }
  }

  return true;
});

router.afterEach((to) => {
  const title = (to.meta.title as string) || "星链后台";
  document.title = `${title} · 星链后台`;
});

export default router;
