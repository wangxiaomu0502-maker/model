#!/usr/bin/env bash
set -euo pipefail

# One-click deploy for xinglian admin + server.
# Usage:
#   ./deploy.sh
#   ./deploy.sh --host 118.195.130.77 --user root --pass 'your_password'
# 未传 --pass 时自动读取仓库根目录 服务器.txt（已在 .gitignore）

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy-lib.sh
source "$ROOT_DIR/deploy-lib.sh"
ADMIN_DIR="$ROOT_DIR/xinglian-admin"
SERVER_DIR="$ROOT_DIR/xinglian-server"

HOST=""
USER_NAME="root"
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --user)
      USER_NAME="$2"
      shift 2
      ;;
    --pass)
      PASSWORD="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

load_deploy_credentials_from_file "$ROOT_DIR/服务器.txt"

if [[ -z "$HOST" || -z "$PASSWORD" ]]; then
  echo "Missing deploy credentials."
  echo "Usage: ./deploy.sh"
  echo "   or: ./deploy.sh --host 118.195.130.77 --user root --pass 'your_password'"
  echo "Tip: create 服务器.txt at repo root (ip / 用户名 / 密码)."
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required. Install first."
  exit 1
fi

# 密码含 |、% 等特殊字符时，用 SSHPASS 比 sshpass -p 更稳妥
export SSHPASS="$PASSWORD"

echo "==> Build admin frontend"
cd "$ADMIN_DIR"
VITE_API_BASE_URL="https://api.xinglianmoku.cn" npm run build

echo "==> Build backend"
cd "$SERVER_DIR"
npm run build

echo "==> Upload admin dist"
sshpass -e scp -o StrictHostKeyChecking=no -r "$ADMIN_DIR/dist/." "${USER_NAME}@${HOST}:/var/www/admin.xinglianmoku.cn/"

echo "==> Package and upload backend"
tar --exclude="node_modules" --exclude="dist" -czf /tmp/xinglian-server.tar.gz .
sshpass -e scp -o StrictHostKeyChecking=no /tmp/xinglian-server.tar.gz "${USER_NAME}@${HOST}:/srv/xinglian-server/"
sshpass -e scp -o StrictHostKeyChecking=no "$SERVER_DIR/.env" "${USER_NAME}@${HOST}:/srv/xinglian-server/.env"

echo "==> Deploy and restart backend on server"
sshpass -e ssh -o StrictHostKeyChecking=no "${USER_NAME}@${HOST}" "\
  set -e && cd /srv/xinglian-server && \
  tar -xzf xinglian-server.tar.gz && rm -f xinglian-server.tar.gz && \
  npm ci && npm run build && \
  (pm2 restart xinglian-server || pm2 start dist/index.js --name xinglian-server) && \
  pm2 save"

echo "==> Validate online endpoints"
curl -I "https://admin.xinglianmoku.cn/" | sed -n '1,8p'
echo "---"
curl -I "https://api.xinglianmoku.cn/api/admin/login" | sed -n '1,12p'

echo "Done."
