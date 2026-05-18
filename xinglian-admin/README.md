# 星链运营后台（xinglian-admin）

Vue 3 + Vite + TypeScript + Element Plus，与仓库内 `xinglian-server` 配套的后台脚手架。

## 开发

```bash
npm install
npm run dev
```

默认端口 **5174**（可用 `npm run dev -- --port 5175` 换端口）。`/api` 由 Vite **代理**到 `http://localhost:3000`，因此请先启动 **`xinglian-server`**。

若列表接口 **404**：先在终端直连后端排查，例如商家列表——`curl "http://localhost:3000/api/admin/merchants?page=1&pageSize=20" -H "Authorization: Bearer <token>"`。  
- 若 **3000 正常、517x 仍 404**：复制 `.env.example` 为 `.env.development.local`，设置 **`VITE_API_BASE_URL=http://localhost:3000`**，再重启 `npm run dev`（前端将直连后端，不依赖代理）。

后台账号在数据库表 **`admin_users`**（与小程序用户表 **`users`** 分离）。访问任意后台页会先跳转 **`/login`**，登录成功后颁发 **`scope: admin`** 的 JWT。

首次部署请在服务端执行 `sql/create-admin-users-table.sql`。默认账号：**`admin`** / **`xinglian@2026`**（务必上线后修改密码）。

接口：`POST /api/admin/login`；请求头携带 `Authorization: Bearer <token>`。

前端三个列表分别调用：**`GET /api/admin/models`**、**`GET /api/admin/merchants`**、**`GET /api/admin/brokers`**（查询参数仅 `page`、`pageSize`）。后端仍可额外提供 **`GET /api/admin/users?role=1|2|3`** 供脚本或其它客户端使用。

订单：**`GET /api/admin/orders`**。

## 构建

```bash
npm run build
npm run preview
```

## 目录提示

- `src/views/LoginView.vue` — 后台登录
- `src/layouts/AdminLayout.vue` — 顶栏 + 侧栏 + 主内容区
- `src/router/index.ts` — 路由守卫（未登录踢回 `/login`）
- `src/views/` — 业务页面（工作台、用户列表等）
