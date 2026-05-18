import path from "path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5174,
    /** 占用时自动换端口，避免误以为「改了没反应」其实在看旧实例 */
    strictPort: false,
    /** 监听所有网卡；本机用 localhost / 局域网 IP 访问时 HMR WebSocket 更不易跑偏 */
    host: true,
    watch: {
      /** WSL 或挂载卷若监听丢变更：终端执行 `CHOKIDAR_USEPOLLING=1 npm run dev` */
      usePolling: process.env.CHOKIDAR_USEPOLLING === "1"
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  /** 与 dev 一致：npm run preview 时才能把 /api 转到本地后端 */
  preview: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
