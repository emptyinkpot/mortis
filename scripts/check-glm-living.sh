#!/usr/bin/env bash
set -euo pipefail
MORTIS_ROOT=${MORTIS_ROOT:-/srv/multica}
MODEL=${MORTIS_GLM_MODEL:-$(grep -E "^(MORTIS_GLM_MODEL|MORTIS_QQ_LLM_MODEL)=" "$MORTIS_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2-)}
BASE_URL=${MORTIS_GLM_BASE_URL:-$(grep -E "^(MORTIS_GLM_BASE_URL|MORTIS_QQ_LLM_BASE_URL)=" "$MORTIS_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2-)}
read_env() {
  local key=$1 file=$2
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- || true
}
select_glm_key() {
  local base="${BASE_URL,,}"
  if [[ "$base" == *"open.bigmodel.cn"* ]]; then
    local key
    key=$(read_env MORTIS_GLM_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
    key=$(read_env ZHIPUAI_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
    key=$(read_env ZHIPU_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
    return
  fi
  if [[ "$base" == *"infini-ai.com"* ]]; then
    local key
    key=$(read_env INFINI_CODING_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
  fi
  local key
  key=$(read_env MORTIS_GLM_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
  key=$(read_env MORTIS_QQ_LLM_API_KEY "$MORTIS_ROOT/.env"); [[ -n "$key" ]] && { echo "$key"; return; }
}
KEY=$(select_glm_key || true)
if [[ -z "$KEY" ]]; then
  echo "GLM key missing for base_url=$BASE_URL. Set MORTIS_GLM_API_KEY/ZHIPUAI_API_KEY for BigModel, or INFINI_CODING_API_KEY for Infini." >&2
  exit 3
fi
code=$(curl -sS -o /tmp/mortis-glm-direct.out -w "%{http_code}" -X POST "${BASE_URL%/}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"只回复：ok\"}],\"max_tokens\":8}")
echo "direct_glm_http=$code"
if [[ "$code" != "200" ]]; then
  head -c 500 /tmp/mortis-glm-direct.out; echo
  exit 5
fi
SECRET=$(grep "^MORTIS_OPERATOR_EVENT_SECRET=" "$MORTIS_ROOT/.env" | tail -1 | cut -d= -f2-)
cat >/tmp/mortis-living-glm-smoke.json <<JSON
{"metadata":{"role_hint":"builder"},"message":{"message_id":9601,"text":"用一句自然的话回答：你现在在吗？","chat":{"id":"glm-smoke","type":"private"},"from":{"id":"operator-glm","first_name":"Operator"}}}
JSON
code=$(curl -sS -o /tmp/mortis-living-glm-smoke.out -w "%{http_code}" -X POST "http://127.0.0.1:8088/api/telegram/living-message?workspace_slug=mortis" \
  -H "Content-Type: application/json" \
  -H "X-Mortis-Operator-Secret: $SECRET" \
  --data-binary @/tmp/mortis-living-glm-smoke.json)
echo "living_http=$code"
cat /tmp/mortis-living-glm-smoke.out; echo
[[ "$code" == "201" ]]
