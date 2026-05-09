#!/usr/bin/env bash
set -euo pipefail

MORTIS_ROOT=${MORTIS_ROOT:-/srv/multica}
ENV_FILE=${MORTIS_ENV_FILE:-$MORTIS_ROOT/.env}
SEND_TEST=${1:-}

read_env() {
  local key=$1
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true
}

TOKEN=${TELEGRAM_BOT_TOKEN:-$(read_env TELEGRAM_BOT_TOKEN)}
CHAT_ID=${MORTIS_TELEGRAM_NOTIFY_CHAT_ID:-$(read_env MORTIS_TELEGRAM_NOTIFY_CHAT_ID)}
SECRET=${MORTIS_OPERATOR_EVENT_SECRET:-$(read_env MORTIS_OPERATOR_EVENT_SECRET)}
NOTIFY_ENABLED=${MORTIS_TELEGRAM_NOTIFY_ENABLED:-$(read_env MORTIS_TELEGRAM_NOTIFY_ENABLED)}

printf 'telegram_token_len=%s\n' "${#TOKEN}"
printf 'telegram_notify_chat_id_len=%s\n' "${#CHAT_ID}"
printf 'operator_secret_len=%s\n' "${#SECRET}"
printf 'telegram_notify_enabled=%s\n' "${NOTIFY_ENABLED:-}"

if [[ -z "$TOKEN" ]]; then
  echo "telegram token missing" >&2
  exit 3
fi

api() {
  local method=$1
  shift || true
  curl -fsS --max-time 20 "https://api.telegram.org/bot${TOKEN}/${method}" "$@"
}

get_me=$(api getMe)
python3 - <<'PY' "$get_me"
import json, sys
payload=json.loads(sys.argv[1])
print('getMe_ok=' + str(payload.get('ok')).lower())
result=payload.get('result') or {}
print('bot_id=' + str(result.get('id','')))
print('bot_username=' + str(result.get('username','')))
print('can_join_groups=' + str(result.get('can_join_groups','')).lower())
print('can_read_all_group_messages=' + str(result.get('can_read_all_group_messages','')).lower())
PY

webhook=$(api getWebhookInfo)
python3 - <<'PY' "$webhook"
import json, sys
payload=json.loads(sys.argv[1])
print('getWebhookInfo_ok=' + str(payload.get('ok')).lower())
result=payload.get('result') or {}
print('webhook_url=' + str(result.get('url','')))
print('pending_update_count=' + str(result.get('pending_update_count','')))
if result.get('last_error_message'):
    print('last_error_message=' + str(result.get('last_error_message')))
PY

if [[ "$SEND_TEST" == "--send-test" ]]; then
  if [[ -z "$CHAT_ID" ]]; then
    echo "notify chat id missing" >&2
    exit 4
  fi
  send=$(curl -fsS --max-time 20 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    --data-urlencode "text=Mortis Telegram runtime smoke: $(date -Is)")
  python3 - <<'PY' "$send"
import json, sys
payload=json.loads(sys.argv[1])
print('sendMessage_ok=' + str(payload.get('ok')).lower())
result=payload.get('result') or {}
print('sent_chat_id=' + str(((result.get('chat') or {}).get('id',''))))
print('sent_message_id=' + str(result.get('message_id','')))
PY
fi
