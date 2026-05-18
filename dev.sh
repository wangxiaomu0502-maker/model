#!/usr/bin/env bash
# 本地同时启动后端 API 与管理端前端；Ctrl+C 会一并结束后台进程。
# 依赖：MySQL 已按 xinglian-server/.env 配置；xinglian-server 与 xinglian-admin 已 npm install。
# 用法：在项目根目录执行 ./dev.sh

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT_DIR/xinglian-server"
ADMIN_DIR="$ROOT_DIR/xinglian-admin"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -f "$SERVER_DIR/package.json" || ! -f "$ADMIN_DIR/package.json" ]]; then
  echo "未找到 xinglian-server 或 xinglian-admin，请在仓库根目录执行本脚本。"
  exit 1
fi

echo "==> 启动后端 (http://localhost:3000，见 xinglian-server/.env 可改 PORT)"
cd "$SERVER_DIR"
npm run dev &
SERVER_PID=$!

echo "==> 等待后端就绪…"
sleep 2

echo "==> 启动管理端 (Vite，默认 http://localhost:5174；/api 代理到 localhost:3000)"
cd "$ADMIN_DIR"
npm run dev
