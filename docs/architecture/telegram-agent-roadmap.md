# Telegram Agent Roadmap

This document records the Telegram direction for Mortis. Telegram is not the source of runtime truth. It is the mobile operator surface for Mortis conversation, approval, artifact, and execution state.

## Current Stage

Mortis already has a first Telegram natural-language gateway:

```text
Telegram
-> n8n
-> /api/telegram/operator-message
-> Mortis Role Router
-> Builder / Tester / Manager role actions
-> Codex-backed execution for code and test work
```

This gives Telegram the same operating model as the previous QQ path at the control layer:

- natural-language input is accepted from chat
- GLM-compatible role runtime remains the chat/planning layer
- Builder and Tester work can enter the Codex execution chain
- high-risk operations still require explicit approval

The next gateway under active development is:

```text
POST /api/telegram/living-message
```

That endpoint is intended to reuse the existing QQ living-agent substrate so Telegram can become a second living-agent projection without creating a separate personality system.

## Do Not Hand-Roll Everything

Mortis should clone proven shapes where they are mature, then keep Mortis-specific truth in its own runtime: workspace, artifacts, approval, timeline, agent identity, and execution evidence.

| Reference | What To Reuse | Mortis Boundary |
| --- | --- | --- |
| n8n Telegram Trigger | P0 webhook adapter, credential handling, Telegram update ingestion | n8n forwards events only; Mortis owns routing and state |
| n8n HTTP Request / Telegram nodes | Low-code request/reply workflow | Do not store business logic in n8n workflows |
| grammY | Future native TypeScript Telegram adapter | Use only after n8n MVP is stable |
| Telegraf | Mature Node.js Telegram webhook/command framework | Useful if grammY does not match deployment needs |
| Botpress Telegram integration | Event normalization, Telegram ids/tags, safe formatting, typing indicators | Do not move Mortis agent runtime into Botpress |
| Chatwoot | Multi-channel conversation/inbox abstraction | Use as reference for channel/inbox/conversation model, not as source of execution truth |
| AutoGen GroupChat | Multi-agent conversation and speaker routing | Useful for future Agent Society, not required for Telegram MVP |
| LangGraph supervisor/swarm | Durable agent handoff graph | Useful after A2A primitives exist |
| OpenHands | Engineering execution runtime, sandbox/action/observation shape | Mortis keeps its own operator policy, approval, and artifact registry |

## Phased Plan

### P0: n8n Telegram Operator Gateway

Status: implemented at the backend contract level.

Goal:

```text
Telegram natural language -> Mortis Role Router -> Codex-backed role action
```

Required pieces:

- `POST /api/telegram/operator-message`
- n8n Telegram Trigger
- n8n HTTP Request to Mortis
- n8n Telegram Send Message for immediate reply
- `MORTIS_TELEGRAM_ALLOWED_USER_IDS` / `MORTIS_TELEGRAM_ALLOWED_CHAT_IDS`
- `MORTIS_OPERATOR_EVENT_SECRET`

### P1: Telegram Living-Agent Projection

Status: in progress.

Goal:

```text
Telegram message -> existing QQ living runtime -> GLM-backed persona reply
```

Required pieces:

- `POST /api/telegram/living-message`
- reuse QQ agent personas, memory, GLM model settings, and fallback behavior
- keep Telegram identity as channel metadata
- return a normal Telegram text reply through n8n

This gives the user the old QQ-like living chat behavior while still keeping execution actions inside the operator gateway.

### P2: Completion Notifier

Status: implemented at the backend contract level.

Goal:

```text
Codex / Builder / Tester completion -> Mortis event -> Telegram notification
```

Required pieces:

- action completion event projection
- Telegram chat id correlation
- artifact links in the reply
- failure and approval-required notifications

### P2.5: Telegram Execution Loop Proof

Status: next validation target.

Goal: verify that a Telegram-originated low-risk Builder task can complete through the full runtime loop:

```text
Telegram -> Role Router -> approved action -> Builder container -> execution_report -> Telegram notifier
```

This is the proof that Telegram has become an operator cockpit rather than only a webhook input.

Required evidence:

- route acknowledgement in Telegram
- Builder action workspace under `MORTIS_AGENT_WORK_ROOT`
- `execution_report` with runtime, branch, changed files, logs, and status
- completion notification back to Telegram

### P3: Native Telegram Adapter

Status: future.

Goal: replace or complement n8n with a first-party adapter when the workflow shape is stable.

Preferred implementation options:

- `grammY` for TypeScript-first Telegram bots
- `Telegraf` if ecosystem integrations fit better

Native adapter responsibilities:

- receive Telegram updates
- normalize into Mortis channel events
- send replies and notifications
- never own role routing, approval, artifacts, or execution state

### P4: Conversation Runtime

Status: future.

Goal: promote Telegram, QQ, Web, and API into the same conversation model.

Reference shape: Chatwoot channel/inbox/conversation abstraction.

Mortis-specific version:

```text
channel
-> inbox/projection
-> conversation_thread
-> conversation_message
-> role_invocation
-> role_action
-> artifact/timeline event
```

### P3.5: Group Chat Turn Runtime

Status: planned; first `ChatRequest.Focus` primitive is implemented.

Canonical plan:

- `docs/architecture/group-chat-turn-runtime.md`

Goal: prevent Telegram/QQ agents from bundling old questions or letting every future agent reply to every message.

Mature shapes to clone:

- Bot Framework `TurnContext` for one incoming message -> one turn
- AutoGen GroupChat speaker selection for explicit speaker gating
- Rasa dialogue policy for treating history as state, not an answer checklist
- Chatwoot conversation ownership for one active owner per conversation
- LangGraph supervisor/handoff later, after Mortis A2A primitives exist

Immediate implementation order:

1. `TurnEnvelope`
2. `SpeakerGate`
3. `ReplyPolicy`
4. `ConversationOwnership`
5. Later LangGraph/AutoGen sidecar experiments

### P5: Agent Society / A2A

Status: future.

Goal: agents can delegate to each other instead of the operator manually sequencing everything.

Reference shapes:

- AutoGen GroupChat for agent-to-agent conversation
- LangGraph supervisor/swarm for durable handoff graphs
- OpenHands for action/observation execution runtime

Mortis-specific primitives must exist first:

- agent registry
- mailbox
- delegation events
- artifact store
- timeline
- role permission policy

## Current User-Facing Capability Target

The target Telegram experience is:

```text
User: 帮我修一下 Telegram 通知
Mortis: 已路由到 Builder，低风险，进入 Codex 执行队列。
...
Mortis: Builder 完成，测试通过，patch/artifact 在这里。
```

For ordinary chat:

```text
User: 你怎么看现在这个架构
Living Agent: 使用 GLM-compatible QQ living runtime 生成自然语言回复。
```

Execution boundary:

- chat/planning/persona reply: GLM-compatible living runtime
- code/test execution: Codex-backed Builder/Tester chain
- approval/deploy/production changes: Mortis approval policy

## External References

- n8n Telegram Trigger: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.telegramtrigger/
- n8n Telegram credentials: https://docs.n8n.io/integrations/builtin/credentials/telegram/
- n8n HTTP Request node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- grammY: https://grammy.dev/guide/
- Telegraf: https://telegraf.js.org/
- Botpress Telegram integration: https://botpress.com/docs/integrations/integration-guides/telegram
- Chatwoot channels: https://www.chatwoot.com/features/channels
- AutoGen GroupChat reference: https://autogenhub.github.io/autogen/docs/reference/agentchat/groupchat/
- OpenHands runtime architecture: https://docs.all-hands.dev/usage/architecture/runtime
