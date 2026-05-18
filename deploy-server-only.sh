#!/usr/bin/env bash
# 仅部署 xinglian-server（跳过管理端构建与上传）。
# Usage:
#   ./deploy-server-only.sh --host 118.195.130.77 --user root --pass 'your_password'

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
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

if [[ -z "$HOST" || -z "$PASSWORD" ]]; then
  echo "Missing required args."
  echo "Usage: ./deploy-server-only.sh --host 118.195.130.77 --user root --pass 'your_password'"
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required. Install first (e.g. brew install hudochenkov/sshpass/sshpass)."
  exit 1
fi

echo "==> Build backend"
cd "$SERVER_DIR"
npm run build

echo "==> Package and upload backend"
tar --exclude="node_modules" --exclude="dist" -czf /tmp/xinglian-server.tar.gz .
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no /tmp/xinglian-server.tar.gz "${USER_NAME}@${HOST}:/srv/xinglian-server/"
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$SERVER_DIR/.env" "${USER_NAME}@${HOST}:/srv/xinglian-server/.env"

echo "==> Deploy and restart backend on server"
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "${USER_NAME}@${HOST}" "\
  set -e && cd /srv/xinglian-server && \
  tar -xzf xinglian-server.tar.gz && rm -f xinglian-server.tar.gz && \
  npm ci && npm run build && \
  (pm2 restart xinglian-server || pm2 start dist/index.js --name xinglian-server) && \
  pm2 save"

echo "==> Ping API"
curl -s -o /dev/null -w "%{http_code}\n" "https://api.xinglianmoku.cn/api/admin/login"

echo "Done (server only)."
