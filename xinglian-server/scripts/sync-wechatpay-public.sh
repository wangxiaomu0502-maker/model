#!/usr/bin/env bash
# 从项目根「支付证书目录」同步微信支付公钥到 xinglian-server/certs/wechatpay_public.pem
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_DIR="$ROOT/支付证书目录"
DEST="$ROOT/xinglian-server/certs/wechatpay_public.pem"

for name in wechatpay_public.pem pub_key.pem 微信支付公钥.pem; do
  if [[ -f "$SRC_DIR/$name" ]]; then
    cp "$SRC_DIR/$name" "$DEST"
    chmod 600 "$DEST"
    echo "已同步: $SRC_DIR/$name -> $DEST"
    exit 0
  fi
done

echo "未找到公钥文件。请在商户平台下载后，将文件放到："
echo "  $SRC_DIR/pub_key.pem"
echo "或  $SRC_DIR/wechatpay_public.pem"
echo "然后重新运行: bash xinglian-server/scripts/sync-wechatpay-public.sh"
exit 1
