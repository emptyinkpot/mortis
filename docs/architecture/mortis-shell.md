---
title: Mortis Shell
status: canonical
scope: operator layer product boundary
---

# Mortis Shell

Mortis is not trying to become another agent runtime or another deep Multica fork.
The next product boundary is:

```text
Single-operator AI operations cockpit
```

Multica remains the runtime foundation. Mortis owns the operator layer around it:

```text
Mortis Shell
-> operator console
-> command center
-> execution journal
-> agent telemetry
-> timeline / watchtower
-> memory adapters
-> computer-use adapters
-> Multica runtime foundation
```

## Current Rule

Do not keep expanding the bottom of the stack as the default path.

Avoid new first-party implementations of:

- agent runtime
- broad multi-agent scheduling
- persona systems
- memory engines
- browser agents
- workflow engines
- task queues
- sandbox kernels

Mortis should integrate mature systems behind stable contracts and spend its own
engineering effort on the operator experience, execution evidence, and cockpit
clarity.

## Product Model

Mortis should feel like an operator is commanding AI workers, not like a user is
filling out another project management board.

Primary surfaces:

- command center: issue one intent and see the active execution chain
- execution journal: durable prompt, command, diff, test, artifact, and verdict trail
- timeline: chronological operator and agent activity
- telemetry: runtime, provider, workspace, queue, and verification status
- watchtower: alerts and important external observations
- memory lens: retrieved facts and durable operator/project memory

Non-goals for the next stage:

- AI society expansion
- personality universe work
- a custom AI IDE
- replacing Multica runtime primitives
- hand-rolled browser/computer-use runtime

## Channel Gateway Boundary

QQ, Telegram, Discord, Web chat, and future official bot integrations are
terminal channels. They are not the Mortis nervous system.

```text
QQ / Telegram / Discord / Web
-> Mortis Gateway
-> Mortis Operator Core
-> Multica Runtime
```

Channel adapters may receive commands, send notifications, and mirror summaries.
They must not own the source of truth for task state, role identity, memory,
workspace execution, or verification evidence.

Current implication: NapCat/QQ instability is treated as channel degradation, not
as core AI failure. The Web Shell and Operator Cockpit must remain usable when
all IM adapters are offline.

OpenClaw, Browser Use, and similar computer-use systems are tool adapters. They
can operate browsers or desktops for a task, but they do not replace the
Operator Core, timeline, artifact graph, or execution journal.

## Architecture

```text
                +------------------+
                | Mortis Shell     |
                | Operator Layer   |
                +---------+--------+
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
+--------------+   +--------------+   +----------------+
| Multica      |   | Memory       |   | Computer Use   |
| Runtime      |   | Adapter      |   | Adapter        |
+--------------+   +--------------+   +----------------+
       |
       v
+---------------------------------------------+
| Claude / Codex / Gemini / provider gateway  |
+---------------------------------------------+
```

## Integration Bias

Use mature systems where the industry has already absorbed the complexity:

| Layer | Preferred direction |
| --- | --- |
| Runtime foundation | Multica compatibility, minimal fork drift |
| Workspace execution | Existing Builder/Tester chain first, OpenHands/SWE-agent as references |
| Long-term memory | mem0 / Letta / Zep behind a `MemoryAdapter` |
| Computer use | Browser Use / Playwright / Stagehand / Skyvern behind adapters |
| Observability | Sentry / Prometheus / Loki / OpenTelemetry where practical |
| Chat/provider layer | reuse stable routing/provider work instead of inventing a new chat kernel |

The adapter contract matters more than the chosen vendor. SQL remains canonical
until an external system is actually connected, verified, and replayable from
Mortis artifacts.

## Execution Priority

P0: Stable single workflow

```text
operator intent
-> structured action contract
-> Builder workspace
-> deterministic artifacts
-> Tester verification
-> operator report
```

P1: Workspace container boundary

```text
action
-> disposable container/process boundary
-> mounted workspace
-> Codex execution
-> artifact collection
-> cleanup
```

P2: Artifact contracts

Every action must produce deterministic evidence:

- prompt / contract
- terminal log
- diff
- commit when code changed
- test report
- verification report
- residual risk

P3: Replay system

An operator must be able to answer:

```text
What did the AI do, why, with what tools, and what proved it worked?
```

P4: Operator cockpit

Expose the state as one coherent control surface:

- active chain
- blocked chain
- last artifact
- last test
- runtime health
- provider failure
- next operator decision

P5: Integrations

Only after P0-P4 are boringly reliable, connect memory/computer-use/workflow
systems behind adapters.

## Upstream Boundary

Deep Multica fork drift is a cost, not a feature.

Mortis should avoid changing Multica-compatible primitives unless required for
the operator shell contract. When a feature can be implemented as a shell,
adapter, or read model, prefer that over kernel mutation.
