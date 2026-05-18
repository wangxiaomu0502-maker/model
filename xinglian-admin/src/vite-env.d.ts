/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 开发环境直连后端根地址，如 http://localhost:3000；不设则走同源 /api（依赖 Vite proxy） */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
