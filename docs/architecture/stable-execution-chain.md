---
title: Mortis Stable Execution Chain
status: canonical-supporting
scope: P0 AI workflow reliability
---

# Mortis Stable Execution Chain

Mortis P0 is not more personas, memory, or external AI infrastructure. P0 is a
single reliable execution chain:

```text
task
-> dispatcher
-> builder-local-codex
-> isolated action workspace
-> repository policy preflight
-> commit + diff + test report
-> tester-local-verifier
-> verification report
-> QQ/Web summary
```

## P0 Boundary

Only these runtime roles are in the stable execution chain:

- Dispatcher
- Builder
- Tester

Everything else is deferred until this chain is boringly reliable:

- persona expansion
- social AI behavior
- memory systems
- browser-use / Watcher ingestion
- LangGraph or OpenHands runtime replacement
- multi-agent scheduling

OpenHands, SWE-agent, OpenDevin, aider, and Claude Code are research references
for workspace/task/runtime design. They are not replacement runtimes until Mortis
can replay its own minimal chain.


## Repository Policy Preflight

Builder runs `scripts/check-repository-policy.sh` inside the cloned action workspace before invoking Codex. If the gate fails, the action is blocked before the worker edits files.

This connects the repository architecture rules to runtime execution:

```text
AI_CONTEXT / ARCHITECTURE / WORKSPACE_RUNTIME
-> scripts/check-repository-policy.sh
-> make policy-check / GitHub Actions
-> Builder preflight
-> runtime artifact
```

## Task Contract

Every executable role action should carry an `action_contract` in
`role_actions.payload`:

```json
{
  "action_type": "code_change",
  "owner": "builder",
  "repo": "mortis",
  "branch": "mortis/action-<id>",
  "objective": "fix a concrete behavior",
  "acceptance": ["observable success condition"],
  "commands": ["pnpm --filter @multica/core typecheck"],
  "risk_level": "low",
  "artifact_required": true,
  "artifact_types": ["commit", "diff", "test_report"]
}
```

The contract is the input boundary. Builder and Tester should not expand scope
outside it.

## Required Artifacts

Builder completion requires:

- `commit` artifact
- `test_report` artifact
- workspace `RUNLOG.md`
- workspace `execution.json`
- workspace `diff.patch`

Tester completion requires:

- `verification_report` artifact
- verification command logs
- evidence status for local commands, artifact graph, CI, staging, and
  observability

Natural language summaries are not delivery evidence. They can only summarize
artifact-backed work.

## Workspace Rule

Each action uses an isolated workspace under:

```text
/srv/multica/agent-workspaces/action-<action_id>/repo
```

Tester verifies Builder output through the source workspace and source
invocation/action IDs. Tester must not modify the Builder checkout.

Containerization wraps this same path in a per-action process boundary instead
of replacing the contract. Builder supports an opt-in `MORTIS_BUILDER_CONTAINER_IMAGE`
mode that runs Codex through `docker run --rm`, mounts the action workspace at
`/workspace`, mounts the configured Codex home when present, and destroys the
container after the command exits. The default empty value keeps the current
backend-container execution path for rollback.

## Replay Standard

For any completed action, an operator should be able to reconstruct:

- prompt / objective
- contract
- workspace path
- changed files
- diff
- commit
- commands run
- logs
- verification result
- remaining risk

If an action cannot be replayed from artifacts, it is not mature enough to count
as stable.

## Builder Runtime Image

Builder execution tools should live in a dedicated image, not in the backend API image.

Canonical Dockerfile:

```text
docker/builder-runtime.Dockerfile
```

Build command:

```bash
docker build -f docker/builder-runtime.Dockerfile -t mortis-builder-runtime:latest docker
```

Runtime configuration:

```env
MORTIS_BUILDER_CONTAINER_IMAGE=mortis-builder-runtime:latest
MORTIS_CODEX_MODEL=gpt-5.4
MORTIS_CODEX_TIMEOUT_SECONDS=900
MORTIS_CODEX_MAX_ATTEMPTS=2
MORTIS_CODEX_DANGEROUSLY_BYPASS_SANDBOX=true
```

The backend image remains focused on serving API traffic. The builder image carries repository execution tools such as `go`, `make`, `pnpm`, `git`, and `codex`. This keeps production API deployment smaller and makes Builder toolchain changes explicit and reproducible.

Operational rule:

- backend image: API server, migrations, dispatcher process
- builder runtime image: Codex execution, repo tests, policy checks, generated patches
- workspaces: still mounted under `MORTIS_AGENT_WORK_ROOT`
- source of truth: role action contract, artifacts, and policy gate, not the container image
