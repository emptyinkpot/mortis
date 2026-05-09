#!/usr/bin/env bash
set -euo pipefail

GROUP_ID="${MORTIS_QQ_LIVING_GROUP_ID:-474958794}"
STATE_DIR="${MORTIS_NAPCAT_WATCHDOG_STATE_DIR:-/srv/multica/openlist-export/runtime}"
STATE_FILE="${STATE_DIR}/napcat-watchdog-state.jsonl"
COOLDOWN_SECONDS="${MORTIS_NAPCAT_WATCHDOG_COOLDOWN_SECONDS:-900}"

mkdir -p "$STATE_DIR"

accounts=(
  "ceo|3974470627|邪恶男娘爱好者|3600|http://127.0.0.1:16099/webui"
  "tester|3615811141|不吃香菜|3610|http://127.0.0.1:16109/webui"
  "builder|3316734532|東風 ソラ|3620|http://127.0.0.1:16119/webui"
  "watcher|2264869713|法式长棍面包|3630|http://127.0.0.1:16129/webui"
)

json_get_user_id() {
  sed -n 's/.*"user_id"[[:space:]]*:[[:space:]]*"\{0,1\}\([0-9]\+\)"\{0,1\}.*/\1/p' | head -n 1
}

post_json() {
  local port="$1"
  local path="$2"
  local payload="$3"
  curl -sS --max-time 8 -X POST "http://127.0.0.1:${port}${path}" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

last_alert_at() {
  local role="$1"
  if [ ! -f "$STATE_FILE" ]; then
    echo 0
    return
  fi
  awk -F'"' -v role="$role" '
    $0 ~ "\"role\":\"" role "\"" && $0 ~ "\"event\":\"offline_alert\"" {
      for (i=1; i<=NF; i++) {
        if ($i == "ts") {
          split($(i+1), a, /[^0-9]/)
          if (a[2] > ts) ts=a[2]
        }
      }
    }
    END { print ts+0 }
  ' "$STATE_FILE"
}

record_event() {
  local role="$1"
  local event="$2"
  local detail="$3"
  local now
  now="$(date +%s)"
  python3 - "$now" "$role" "$event" "$detail" >> "$STATE_FILE" <<'PY'
import json
import sys

print(json.dumps({
    "ts": int(sys.argv[1]),
    "role": sys.argv[2],
    "event": sys.argv[3],
    "detail": sys.argv[4],
}, ensure_ascii=False))
PY
}

send_alert() {
  local failed_role="$1"
  local expected_uin="$2"
  local nickname="$3"
  local detail="$4"
  local webui="$5"
  local text
  text="NapCat 守护报警：${nickname}/${failed_role}(${expected_uin}) 当前不可用。证据：${detail}。处理：检查 ${webui}，必要时完成 QQ 安全验证；恢复后必须做跨账号可见性验证。"

  for account in "${accounts[@]}"; do
    IFS='|' read -r role uin _ port _webui <<<"$account"
    if [ "$role" = "$failed_role" ]; then
      continue
    fi
    info="$(post_json "$port" "/get_login_info" '{}')" || continue
    got="$(printf '%s' "$info" | json_get_user_id)"
    if [ "$got" = "$uin" ]; then
      message_json="$(
        python3 -c 'import json,sys; print(json.dumps(sys.stdin.read(), ensure_ascii=False))' <<EOF
$text
EOF
      )"
      payload="$(printf '{"group_id":%s,"message":%s}' "$GROUP_ID" "$message_json")"
      post_json "$port" "/send_group_msg" "$payload" >/dev/null || true
      return 0
    fi
  done
  return 1
}

now="$(date +%s)"
overall=0
for account in "${accounts[@]}"; do
  IFS='|' read -r role expected_uin nickname port webui <<<"$account"
  info="$(post_json "$port" "/get_login_info" '{}' 2>&1)" || {
    detail="get_login_info failed on port ${port}: ${info}"
    overall=1
    last="$(last_alert_at "$role")"
    if [ $((now - last)) -ge "$COOLDOWN_SECONDS" ]; then
      send_alert "$role" "$expected_uin" "$nickname" "$detail" "$webui" || true
      record_event "$role" "offline_alert" "$detail"
    fi
    continue
  }
  got="$(printf '%s' "$info" | json_get_user_id)"
  if [ "$got" != "$expected_uin" ]; then
    detail="expected ${expected_uin} on port ${port}, got ${got:-none}"
    overall=1
    last="$(last_alert_at "$role")"
    if [ $((now - last)) -ge "$COOLDOWN_SECONDS" ]; then
      send_alert "$role" "$expected_uin" "$nickname" "$detail" "$webui" || true
      record_event "$role" "offline_alert" "$detail"
    fi
    continue
  fi
  record_event "$role" "online" "port ${port} user_id ${got}"
done

exit "$overall"
