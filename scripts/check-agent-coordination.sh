#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

fail() {
  echo "[agent-coordination] FAIL: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "missing required coordination file: $1"
}

require_file .runtime/README.md
require_file .runtime/claims/.gitkeep
require_file .runtime/timeline/.gitkeep
require_file .runtime/agents/.gitkeep
require_file .runtime/artifacts/.gitkeep
require_file .runtime/locks/.gitkeep
require_file .runtime/events/.gitkeep
require_file .runtime/mailboxes/.gitkeep
require_file contracts/agent-claim.schema.json
require_file contracts/agent-timeline-event.schema.json

node <<'NODE'
const fs = require('fs');
for (const path of [
  'contracts/agent-collaboration-policy.json',
  'contracts/agent-claim.schema.json',
  'contracts/agent-timeline-event.schema.json',
]) {
  JSON.parse(fs.readFileSync(path, 'utf8'));
}
NODE

grep -Fq 'Read `.runtime/claims/`' AGENT_WORKFLOW.md \
  || fail 'AGENT_WORKFLOW.md must require reading .runtime/claims before work'
grep -Fq 'Claim files are the coordination truth' AGENT_WORKFLOW.md \
  || fail 'AGENT_WORKFLOW.md must define claim files as coordination truth'
grep -Fq 'active' contracts/agent-claim.schema.json \
  || fail 'agent claim schema must define statuses'

echo '[agent-coordination] OK'
