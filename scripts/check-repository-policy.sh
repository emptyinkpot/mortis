#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

fail() {
  echo "[repository-policy] FAIL: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "missing required repository entrypoint: $1"
}

require_file README.md
require_file CONTRIBUTING.md
require_file LICENSE
require_file AI_CONTEXT.md
require_file ARCHITECTURE.md
require_file SYSTEM_TOPOLOGY.md
require_file AGENT_RUNTIME.md
require_file WORKSPACE_RUNTIME.md
require_file SECURITY.md
require_file SUPPORT.md
require_file AGENT_WORKFLOW.md
require_file contracts/agent-collaboration-policy.json
require_file contracts/agent-claim.schema.json
require_file contracts/agent-timeline-event.schema.json
require_file .runtime/README.md
require_file scripts/check-agent-coordination.sh
require_file .github/CODEOWNERS
require_file .github/PULL_REQUEST_TEMPLATE.md
require_file .github/ISSUE_TEMPLATE/agent-task.yml
require_file .github/workflows/repository-policy.yml
require_file docs/operations/current-runtime-map.md
require_file docs/topology/operator-bus.md
require_file project.json

node <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('project.json', 'utf8'));
const expected = 'ubuntu@124.220.233.126:/srv/multica';
const errors = [];
if (data.remoteFirstSourceRoot !== expected) errors.push('project.json remoteFirstSourceRoot must be ' + expected);
if (data.localSourceRoot !== null) errors.push('project.json localSourceRoot must be null');
if (data.status !== 'remote-first-worktree') errors.push('project.json status must be remote-first-worktree');
const sourceRoots = data.sourceRoots || {};
if (sourceRoots.remoteFirstRoot !== expected) errors.push('project.json sourceRoots.remoteFirstRoot must be ' + expected);
if (sourceRoots.canonicalLocalRoot !== null) errors.push('project.json sourceRoots.canonicalLocalRoot must be null');
if (errors.length) {
  for (const error of errors) console.log('[repository-policy] FAIL:', error);
  process.exit(1);
}
NODE


node <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('contracts/agent-collaboration-policy.json', 'utf8'));
const errors = [];
if (data.name !== 'agent-collaboration-policy') errors.push('agent collaboration policy name mismatch');
if (data.mainBranch !== 'main') errors.push('agent collaboration policy mainBranch must be main');
if (data.canonicalSourceRoot !== 'ubuntu@124.220.233.126:/srv/multica') errors.push('agent collaboration policy canonicalSourceRoot must be remote /srv/multica');
if (data.directMainPush !== false) errors.push('agent collaboration policy directMainPush must be false');
for (const key of ['requireTopicBranch', 'requireDedicatedWorktree', 'forbidWholeWorktreeStaging']) {
  if (data[key] !== true) errors.push(`agent collaboration policy ${key} must be true`);
}
for (const command of ['git add .', 'git commit -a', 'git push origin main', 'git push --force']) {
  if (!(data.forbiddenCommands || []).includes(command)) errors.push('agent collaboration policy must forbid ' + command);
}
for (const state of ['pr-opened', 'branch-pushed', 'local-only-by-request', 'blocked']) {
  if (!(data.deliveryStates || []).includes(state)) errors.push('agent collaboration policy missing delivery state ' + state);
}
if (data.coordinationTruth !== 'claim-registry') errors.push('agent collaboration policy coordinationTruth must be claim-registry');
for (const status of ['active', 'blocked', 'review', 'handoff', 'completed', 'abandoned']) {
  if (!(data.claimStatuses || []).includes(status)) errors.push('agent collaboration policy missing claim status ' + status);
}
if (errors.length) {
  for (const error of errors) console.log('[repository-policy] FAIL:', error);
  process.exit(1);
}
NODE

for path in AI_CONTEXT.md README.md ARCHITECTURE.md SYSTEM_TOPOLOGY.md WORKSPACE_RUNTIME.md docs/operations/current-runtime-map.md; do
  grep -Fq 'ubuntu@124.220.233.126:/srv/multica' "$path" || fail "$path does not mention the remote-first source root"
done

git grep -n -E '本机唯一源码真源|active-local-worktree|only canonical local source tree' --   ':!node_modules' ':!**/node_modules/**' ':!agent-workspaces/**' ':!openlist-export/**' ':!codex-home/**' ':!scripts/check-repository-policy.sh'   && fail 'found retired local-source wording' || true

tracked_runtime_paths="$(git ls-files 'agent-workspaces/**' 'openlist-export/**' 'codex-home/**')"
if [ -n "$tracked_runtime_paths" ]; then
  echo "$tracked_runtime_paths" >&2
  fail 'runtime state directories must not be tracked in git'
fi

grep -Fq 'n8n、QQ、Telegram 都只是 gateway/projection，不是源码真相源。' AI_CONTEXT.md   || fail 'AI_CONTEXT.md must keep channel projection boundary explicit'

grep -Fq 'Before editing this repository, every AI agent must read `AGENT_WORKFLOW.md`' AI_CONTEXT.md   || fail 'AI_CONTEXT.md must require AGENT_WORKFLOW.md before editing'
grep -Fq 'No agent may edit `main` directly.' AGENT_WORKFLOW.md   || fail 'AGENT_WORKFLOW.md must forbid direct main edits'
grep -Fq 'git worktree add' AGENT_WORKFLOW.md   || fail 'AGENT_WORKFLOW.md must document dedicated worktree creation'
grep -Fq 'git add .' AGENT_WORKFLOW.md   || fail 'AGENT_WORKFLOW.md must explicitly forbid whole-worktree staging'
grep -Fq '@emptyinkpot' .github/CODEOWNERS   || fail '.github/CODEOWNERS must define repository owner review path'


bash scripts/check-agent-coordination.sh

echo '[repository-policy] OK'
