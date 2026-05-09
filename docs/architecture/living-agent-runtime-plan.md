# Living Agent Runtime Plan

Mortis now has two Telegram paths:

```text
Telegram -> n8n -> /api/telegram/operator-message -> Role Router -> Builder / Tester / Manager
Telegram -> n8n -> /api/telegram/living-message -> Living Agent runtime -> persona reply + memory traces
```

The first path is the operator execution chain. The second path is the social/living-agent projection. They must stay separate so chat personality does not bypass approval, artifact, or execution policy.

## Current State

What is already real:

- Telegram is the primary mobile surface; QQ/NapCat is legacy and should not guide new work.
- n8n receives Telegram updates and forwards them into Mortis.
- `/api/telegram/living-message` reuses the existing living-agent substrate and writes journal/emotion traces.
- `/api/telegram/operator-message` routes executable requests into Mortis role actions.
- Builder and Tester have a working closed loop for approved repository work.
- Dedicated Builder image rollout has started with `MORTIS_BUILDER_CONTAINER_IMAGE`.

What is not yet real:

- Letta is present as a deployed service, but it is not yet the canonical memory adapter.
- SillyTavern patterns are not integrated; they are reference material for character/lorebook design.
- ElizaOS patterns are not integrated; they are reference material for room/social-agent behavior.
- Telegram group multi-bot society is not yet A2A; current execution is still Mortis-orchestrated.

## Mature Systems To Reuse

| System | Use It For | Do Not Use It For |
| --- | --- | --- |
| Letta | persistent agent memory, persona state, recall APIs | replacing Mortis approval/execution policy |
| SillyTavern | character cards, lorebook, conversation style patterns | production orchestration or source of truth |
| ElizaOS | social room behavior, channel adapters, agent presence | direct repository execution |
| AutoGen | future group-chat/A2A speaker routing | immediate P0 execution chain |
| OpenHands | engineering runtime and action/observation ideas | replacing current Builder before smoke tests are stable |
| n8n | Telegram webhook and automation glue | long-term business logic or memory ownership |

## P0: Stabilize Existing Runtime

Goal: make the current Telegram + Builder chain reliable before adding another agent framework.

Tasks:

1. Keep n8n workflow pointed at `/api/telegram/living-message` for ordinary conversation.
2. Keep executable operator actions routed through `/api/telegram/operator-message`.
3. Finish Builder container smoke: backend must launch `mortis-builder-runtime:latest`, mount the action workspace, and feed Codex the prompt using the container path `/workspace/builder-prompt.md`.
4. Keep `.env.example` with `MORTIS_BUILDER_CONTAINER_IMAGE=` blank by default so a fresh deployment does not enable a missing image.
5. Record GLM provider failures explicitly and use the contextual fallback only as degraded mode.

Exit criteria:

- Telegram ordinary chat returns a living reply and writes memory traces.
- Telegram-originated low-risk Builder task completes or blocks with a concrete artifact-backed reason.
- Builder container mode no longer fails on host/container path drift.

## P1: Letta Memory Adapter

Goal: stop hand-growing personality memory tables into an unbounded custom memory system.

Implementation boundary:

```text
Living Agent runtime
-> MemoryAdapter
-> SQL local traces + Letta external memory
```

Required adapter methods:

- `RememberMessage(agent_id, channel, actor, text, metadata)`
- `RecallContext(agent_id, thread_id, query, limit)`
- `UpdatePersonaState(agent_id, patch)`
- `RecordEmotion(agent_id, signal, confidence, source_event_id)`

Letta becomes a memory backend. Mortis still owns channel identity, operator policy, execution state, artifacts, and timeline.

## P2: Personality Quality Layer

Goal: stop sounding like a support bot without hard-coding fake intimacy.

Borrow from SillyTavern:

- character card fields for stable voice and boundaries
- lorebook entries for project-specific memory
- conversation examples for style calibration
- anti-template tests for fallback replies

Runtime rules:

- fallback replies must mention concrete context from the user message when possible
- no generic customer-service apology loops
- no claim of model/provider success when GLM failed
- no execution promise unless an operator action was created

## P3: Social Room / Group Behavior

Goal: prepare Telegram group behavior without turning Telegram into the source of truth.

Borrow from ElizaOS:

- room/channel state
- agent presence
- reply decision policy
- mention/reply routing
- memory scoped by room and actor

Mortis-specific boundary:

```text
Telegram Group
-> channel event
-> Mortis conversation thread
-> living reply or operator action
-> timeline/artifact projection
```

## P4: Real A2A

Do not call this complete until agents can initiate delegation themselves.

Required primitives are defined in `docs/architecture/a2a-messaging-layer.md`:

- agent registry
- stable agent IDs
- mailbox
- delegation events
- artifact references
- timeline projection
- permission rules

## Immediate Next Move

The next engineering move is not another personality prompt. It is closing the Builder runtime image smoke and then adding a `MemoryAdapter` interface that can point to Letta without deleting the existing SQL traces.