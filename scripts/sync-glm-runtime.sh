#!/usr/bin/env bash
set -euo pipefail

MORTIS_ROOT=${MORTIS_ROOT:-/srv/multica}
AICLIENT_ROOT=${AICLIENT_ROOT:-/srv/aiclient2api}
MORTIS_COMPOSE=${MORTIS_COMPOSE:-docker-compose.selfhost.yml}
AICLIENT_SERVICE=${AICLIENT_SERVICE:-aiclient-api}
MODEL=${MORTIS_GLM_MODEL:-${MORTIS_QQ_LLM_MODEL:-glm-4.5}}
BASE_URL=${MORTIS_GLM_BASE_URL:-${MORTIS_QQ_LLM_BASE_URL:-https://open.bigmodel.cn/api/paas/v4}}

read_env() {
  local key=$1 file=$2
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

if [[ ! -f "$MORTIS_ROOT/.env" ]]; then
  echo "missing Mortis env: $MORTIS_ROOT/.env" >&2
  exit 2
fi

select_glm_key() {
  local base="${BASE_URL,,}"
  if [[ "$base" == *"open.bigmodel.cn"* ]]; then
    firstNonEmpty=$(read_env MORTIS_GLM_API_KEY "$MORTIS_ROOT/.env")
    [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
    firstNonEmpty=$(read_env ZHIPUAI_API_KEY "$MORTIS_ROOT/.env")
    [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
    firstNonEmpty=$(read_env ZHIPU_API_KEY "$MORTIS_ROOT/.env")
    [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
    return
  fi
  if [[ "$base" == *"infini-ai.com"* ]]; then
    firstNonEmpty=$(read_env INFINI_CODING_API_KEY "$MORTIS_ROOT/.env")
    [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
  fi
  firstNonEmpty=$(read_env MORTIS_GLM_API_KEY "$MORTIS_ROOT/.env")
  [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
  firstNonEmpty=$(read_env MORTIS_QQ_LLM_API_KEY "$MORTIS_ROOT/.env")
  [[ -n "$firstNonEmpty" ]] && { echo "$firstNonEmpty"; return; }
}

GLM_KEY=$(select_glm_key || true)
if [[ -z "$GLM_KEY" ]]; then
  echo "GLM key missing for base_url=$BASE_URL. Set MORTIS_GLM_API_KEY/ZHIPUAI_API_KEY for BigModel, or INFINI_CODING_API_KEY for Infini." >&2
  exit 3
fi

GATEWAY_KEY=$(read_env OPENAI_API_KEY "$MORTIS_ROOT/.env")
if [[ -z "$GATEWAY_KEY" ]]; then
  echo "gateway key missing. OPENAI_API_KEY is required for aiclient2api ingress auth" >&2
  exit 4
fi

python3 - <<PY
from pathlib import Path
p=Path("$MORTIS_ROOT/.env")
s=p.read_text()
def set_line(src,key,value):
    line=f"{key}={value}"
    lines=src.splitlines()
    for i,l in enumerate(lines):
        if l.startswith(key+"="):
            lines[i]=line
            return "\n".join(lines)+("\n" if src.endswith("\n") else "")
    return src.rstrip("\n")+"\n"+line+"\n"
s=set_line(s,"MORTIS_QQ_LLM_ENABLED","true")
s=set_line(s,"MORTIS_QQ_LLM_BASE_URL","$BASE_URL")
s=set_line(s,"MORTIS_QQ_LLM_MODEL","$MODEL")
s=set_line(s,"MORTIS_GLM_BASE_URL","$BASE_URL")
s=set_line(s,"MORTIS_GLM_MODEL","$MODEL")
s=set_line(s,"MORTIS_QQ_LLM_WIRE_API","chat_completions")
p.write_text(s)
PY

if [[ -d "$AICLIENT_ROOT" ]]; then
  sudo -n chown -R "$(id -u):$(id -g)" "$AICLIENT_ROOT/configs" 2>/dev/null || true
  mkdir -p "$AICLIENT_ROOT/configs"
  python3 - <<PY
import json
from pathlib import Path
root=Path("$AICLIENT_ROOT")
config={
  "REQUIRED_API_KEY": "$GATEWAY_KEY",
  "SERVER_PORT": 3000,
  "HOST": "0.0.0.0",
  "MODEL_PROVIDER": "openai-custom",
  "PROVIDER_POOLS_FILE_PATH": "configs/provider_pools.json",
  "REQUEST_MAX_RETRIES": 0,
  "MAX_ERROR_COUNT": 3,
  "SCHEDULED_HEALTH_CHECK": {"enabled": True, "interval": 600000, "startupRun": True},
}
(root/"configs/config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2)+"\n")
pools={
  "openai-custom": [{
    "uuid": "glm-bigmodel-primary",
    "customName": "GLM BigModel Primary",
    "OPENAI_BASE_URL": "$BASE_URL",
    "OPENAI_API_KEY": "$GLM_KEY",
    "supportedModels": ["glm-4.6", "glm-4.5", "glm-4-plus", "glm-4-air", "glm-4-flash", "glm-4"],
    "isDisabled": False,
    "isHealthy": True,
  }]
}
(root/"configs/provider_pools.json").write_text(json.dumps(pools, ensure_ascii=False, indent=2)+"\n")
PY
  chmod 600 "$AICLIENT_ROOT/configs/config.json" "$AICLIENT_ROOT/configs/provider_pools.json"
fi

cd "$MORTIS_ROOT"
sudo -n docker compose -f "$MORTIS_COMPOSE" up -d backend >/dev/null

if [[ -d "$AICLIENT_ROOT" ]]; then
  cd "$AICLIENT_ROOT"
  sudo -n docker compose restart "$AICLIENT_SERVICE" >/dev/null
fi

echo "GLM runtime synced: model=$MODEL base_url=$BASE_URL"
