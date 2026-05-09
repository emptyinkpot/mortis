# Architecture

Mortis is an Operator Shell for private AI operations. It is not primarily a chatbot, generic task board, or AI IDE.

## One Sentence

Mortis turns channel messages and web actions into durable operator events, routes them through Mortis Core, executes work through controlled agent runtimes, and records artifacts for timeline, approval, replay, and reporting.

## Current Topology

```text
Channels
-> Unified Operator Event
-> Mortis Core
-> Dispatcher / Runtime Routing
-> Agent Runtime
-> Artifacts / Timeline / Approval
-> Channel Projection
```

## Core Layers

### Channel Projection

QQ, Telegram, Web, n8n, Scheduler, GitHub, and future adapters are projections. They provide input and output, but they do not own command semantics.

### Mortis Core

Mortis Core owns:

- command interpretation
- workspace selection
- task contracts
- approval semantics
- runtime routing
- artifact references
- timeline state

### Dispatcher

The dispatcher converts approved operator intent into executable runtime actions.

Current P0 chain:

```text
Dispatcher
-> Builder
-> Tester
-> Artifact
-> Report
```

### Agent Runtime

Agent runtimes execute controlled work. The current proven code path uses `builder-local-codex` and `tester-local-verifier` with action workspaces under `/srv/multica/agent-workspaces`.

### Artifact Runtime

Natural language is not delivery evidence. Runtime work should produce durable artifacts:

- commit
- diff
- logs
- test report
- verification report
- screenshots when applicable
- replay metadata

### Timeline Runtime

Timeline connects events, actions, artifacts, approvals, and replies into one operational history.

## Source Boundary

The default shared source root is:

```text
ubuntu@124.220.233.126:/srv/multica
```

Do not treat a local checkout as the Mortis source of truth.

## Further Reading

- `AI_CONTEXT.md`
- `docs/architecture/mortis-shell.md`
- `docs/architecture/stable-execution-chain.md`
- `docs/architecture/agent-os-core.md`
- `docs/topology/operator-bus.md`
- `docs/philosophy/operator-event-runtime.md`
- `docs/reference-architecture/README.md`
