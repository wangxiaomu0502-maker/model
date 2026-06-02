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
    [[ -z "$line" ]] && continue
    # 全角冒号「：」在部分 bash 下无法被 [：:] 匹配，用「非数字前缀 + 捕获」更稳妥
    if [[ "$line" =~ ^ip[^0-9]*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
      [[ -z "${HOST:-}" ]] && HOST="${BASH_REMATCH[1]}"
    elif [[ "$line" == 用户名：* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户名：}"
    elif [[ "$line" == 用户名:* ]]; then
      [[ -z "${USER_NAME:-}" ]] && USER_NAME="${line#用户名:}"
    elif [[ "$line" == 密码：* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#密码：}"
    elif [[ "$line" == 密码:* ]]; then
      [[ -z "${PASSWORD:-}" ]] && PASSWORD="${line#密码:}"
    fi
  done < "$cred_file"
}
