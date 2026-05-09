# Mature Agent Systems Adoption Plan

Mortis should not hand-roll mature agent infrastructure when a proven open-source system already owns that primitive. Mortis should adopt mature systems through narrow adapters while keeping its own operator truth: event bus, approvals, artifacts, timeline, execution contracts, and workspace policy.

## Principle

Clone mature systems to learn and reuse boundaries. Do not import a whole product as Mortis Core.

```text
Telegram / Web / API
-> Mortis Core
-> MemoryAdapter / RuntimeAdapter / ChannelAdapter
-> mature external systems where useful
```

## Adopt Directly

| System | Repository | Mortis Use | Boundary |
| --- | --- | --- | --- |
| n8n | https://github.com/n8n-io/n8n | Telegram webhook, HTTP routing, low-code automation glue | n8n forwards events only; Mortis owns state and policy |
| Letta | https://github.com/letta-ai/letta | long-term memory, persona state, recall APIs | Use behind `MemoryAdapter`; do not replace Mortis execution or approval |
| grammY | https://github.com/grammyjs/grammy | future native Telegram adapter | Use only after n8n workflow shape is stable |
| AstrBot | https://github.com/AstrBotDevs/AstrBot | mature multi-platform chatbot shell, WebUI, plugin ecosystem, knowledge base, MCP/tool UI | Use through fork/plugin/adapter; do not replace Mortis Core |

## Reference Only

| System | Repository | Concepts To Reuse | Do Not Copy |
| --- | --- | --- | --- |
| SillyTavern | https://github.com/SillyTavern/SillyTavern | character cards, lorebook, example dialogue, scenario/persona structure | Do not run it as production runtime or source of truth |
| ElizaOS | https://github.com/elizaOS/eliza | room state, agent presence, social reply policy, channel behavior | Do not route repo execution through it |
| OpenHands | https://github.com/OpenHands/OpenHands | engineering runtime, sandbox, action/observation loop, artifact handling | Do not replace current Builder until smoke tests are stable |
| Botpress | https://github.com/botpress/botpress | Telegram integration and conversation event normalization | Do not move Mortis business logic into Botpress |
| AutoGen | https://github.com/microsoft/autogen | group chat, speaker routing, agent-to-agent conversation | Do not start free-form multi-agent chat before A2A primitives are stable |

## Mortis Keeps Ownership

Mortis remains the source of truth for:

- workspace identity
- channel identity
- operator permissions
- approval policy
- role action contracts
- Builder / Tester execution reports
- artifacts and evidence
- timeline projection
- A2A mailbox and delegation records

## Phase Plan

### P0: Telegram Living Payload Compatibility

Fix `/api/telegram/living-message` so it accepts real n8n and Telegram update shapes:

- top-level `{ "message": ... }`
- raw Telegram update `{ "update_id": ..., "message": ... }`
- n8n webhook wrapper `{ "body": { "message": ... } }`
- n8n item wrapper `{ "json": { "message": ... } }`

Exit criteria:

- malformed payloads return a concrete 400 reason
- supported n8n shapes return `201`
- living replies remain separate from operator execution actions

### P1: Letta Memory Adapter

Add a `MemoryAdapter` boundary:

```text
Living Agent runtime
-> MemoryAdapter
   -> SQL local traces
   -> Letta external memory
```

Initial adapter methods:

- `RememberMessage(agent_id, channel, actor, text, metadata)`
- `RecallContext(agent_id, thread_id, query, limit)`
- `UpdatePersonaState(agent_id, patch)`
- `RecordEmotion(agent_id, signal, confidence, source_event_id)`

### P2: Persona Card and Lorebook Schema

Borrow SillyTavern's shape without embedding SillyTavern:

- character card fields
- lorebook entries
- example dialogue
- style boundaries
- anti-template fallback tests

### P3: Social Room Policy

Borrow ElizaOS-style room behavior only after private Telegram chat is stable:

- room state
- mention routing
- reply decision policy
- cooldown
- per-room memory scope

### P4: Engineering Runtime Experiments

Keep current Codex Builder container as stable baseline. Add optional runtime experiments behind `BuilderRuntime` interface:

- OpenHands runtime experiment
- AutoGen/A2A coordination experiment

Experiments must not bypass Mortis action contracts, approval, or artifact requirements.

## Current Next Move

The immediate next move is P0: fix Telegram living payload compatibility before adding Letta or another social-agent framework.

## AstrBot Integration

The detailed AstrBot fusion and upstream contribution plan is recorded in `docs/architecture/astrbot-mortis-integration-plan.md`. Mortis uses `emptyinkpot/AstrBot` as the owned fork for upstreamable AstrBot changes while `/srv/astrbot` remains a deployment checkout.
