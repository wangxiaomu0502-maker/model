#!/usr/bin/env bash
# 从仓库根目录 服务器.txt 读取部署凭据（已在 .gitignore）
# 格式示例：
#   ip：118.195.130.77
#   用户名：root
#   密码：your_password

load_deploy_credentials_from_file() {
  local cred_file="$1"
  [[ -f "$cred_file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    # 兼容「ip/IP/服务器」等描述，只要该行含 IPv4 即可识别主机。
    if [[ "$line" =~ ([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}) ]]; then
      [[ -z "${HOST:-}" ]] && HOST="${BASH_REMATCH[1]}"
    elif [[ "$line" == 用户名：* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户名：}"
    elif [[ "$line" == 用户名:* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户名:}"
    elif [[ "$line" == 用户：* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户：}"
    elif [[ "$line" == 用户:* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户:}"
    elif [[ "$line" == 密码：* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#密码：}"
    elif [[ "$line" == 密码:* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#密码:}"
    elif [[ "$line" == password:* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#password:}"
    elif [[ "$line" == pass:* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#pass:}"
    fi
  done < "$cred_file"

  USER_NAME="${USER_NAME#"${USER_NAME%%[![:space:]]*}"}"
  USER_NAME="${USER_NAME%"${USER_NAME##*[![:space:]]}"}"
  PASSWORD="${PASSWORD#"${PASSWORD%%[![:space:]]*}"}"
  PASSWORD="${PASSWORD%"${PASSWORD##*[![:space:]]}"}"
}
