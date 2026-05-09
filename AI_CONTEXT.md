# AI Context

Before editing this repository, every AI agent must read `AGENT_WORKFLOW.md`, `contracts/agent-collaboration-policy.json`, `.runtime/claims/`, and `.runtime/timeline/`. Direct edits to `main` are forbidden. Each agent must check for overlapping claims, claim a task, create a dedicated branch and worktree, use path-scoped staging, run policy checks, and deliver via PR or explicit branch handoff.

Before modifying Mortis, read this file first.

Mortis is not a traditional chatbot, CRUD admin panel, generic task board, or AI IDE. Mortis is an operator shell for private AI operations.

## Read Order For Architecture Work

1. `README.md`
2. `ARCHITECTURE_INSPIRATIONS.md`
3. `docs/reference-architecture/README.md`
4. `docs/architecture/mortis-shell.md`
5. `docs/architecture/stable-execution-chain.md`
6. `docs/architecture/agent-os-core.md`
7. `docs/philosophy/operator-event-runtime.md`
8. `docs/topology/operator-bus.md`
9. `docs/architecture/agent-society-runtime.md`
10. `docs/operations/current-runtime-map.md`
11. `docs/operations/telegram-operator-gateway.md`

## 远端修改端硬规则

- 默认共同源码工作地是 `ubuntu@124.220.233.126:/srv/multica`。
- 任何代码、文档、部署配置修改，默认都应在远端 `/srv/multica` 进行。
- 正常流程是：远端修改 -> 远端验证 -> 远端提交 -> 推送 GitHub main。
- 本机 `E:\My Project\Mortis` 已删除并退役；如果之后重新 clone，只能作为同步副本，不能作为默认修改端。
- 不要再把本机路径写成 Mortis 的 source of truth。
- Telegram 是当前主移动 Operator Surface；n8n 是 Telegram 自动化网关；QQ/NapCat 已降级为 legacy/optional channel projection，不得作为主排障方向。
- n8n、QQ、Telegram 都只是 gateway/projection，不是源码真相源。


## Channel Priority

- Primary mobile operator route: Telegram -> n8n -> Mortis Operator Event API.
- Primary source of truth: Mortis Core, artifacts, timeline, and A2A runtime primitives.
- Legacy route: QQ/NapCat is retained only for compatibility and notifications. QQ account login failures, NapCat verification loops, or QQ group history issues must not steer architecture or normal incident triage unless the user explicitly asks for QQ.

## Core Principles

- Operator-first: the human operator remains the command authority.
- Event-first: Telegram, Web, Scheduler, GitHub, and legacy QQ should become normalized operator events.
- Artifact-first: agents do not merely say they are done; they produce commits, diffs, reports, evidence, and verification artifacts.
- Timeline-first: important state transitions should be visible as an operational timeline.
- Channel projection: Telegram and Web are primary projections of the same runtime; QQ is legacy/optional and must not define business logic.
- Stable execution before agent expansion: keep Dispatcher -> Builder -> Tester -> Artifact -> Report reliable before adding more agents.
- Agent society requires shared workspace, artifacts, turn discipline, and timeline; Telegram is only the group-room projection.

## What Not To Do

Do not add a new persona, runtime, or channel-specific workflow unless it strengthens the stable operator execution chain.

Do not duplicate command logic separately in Telegram, Web, n8n, or legacy QQ.

Do not treat n8n as the Mortis source of truth. n8n is an automation gateway and prototyping layer.

Do not treat Telegram as a chat-bot brain. Telegram is the primary mobile operator cockpit projection; command semantics stay in Mortis Core.

## Current Runtime Boundary

```text
Channels
-> Unified Operator Event
-> Mortis Core
-> Dispatcher / Runtime Routing
-> Agent Execution
-> Artifacts / Timeline / Approval
-> Channel Projection
```

## Executable Gates

- Before committing repository policy, source-root, channel-gateway, or architecture-entrypoint changes, run `make policy-check` or `bash scripts/check-repository-policy.sh`.

## Safe Next Changes

Prefer changes that strengthen one of these layers:

- unified event ingestion
- task contracts
- deterministic artifacts
- timeline events
- approval objects
- replayability
- channel projections
- operator cockpit visibility
