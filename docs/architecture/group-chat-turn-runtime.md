# Group Chat Turn Runtime Plan

Mortis Telegram/QQ living agents must not behave like a command bot that answers accumulated history. A group chat runtime needs an explicit turn model, speaker gate, and handoff policy.

This plan records mature systems to clone from and the smallest Mortis-specific runtime primitives to implement.

## Problem Exposed

The observed Telegram conversation showed this failure mode:

```text
User asks several short questions.
Mortis later replies with a bundled answer to multiple older questions.
User complains that Mortis is still doing it.
Mortis again includes old capability boilerplate.
```

This is not mainly a model quality problem. It is a turn-runtime problem.

The model was given recent transcript as context, but the runtime did not strongly define the current reply target. The model treated history like an answer checklist.

## Current State

Implemented primitives:

```text
ChatRequest.Focus
TurnEnvelope
SpeakerDecision / SpeakerGate
```

Current behavior after `5e0f86c fix: add living turn focus policy`:

- QQ living replies pass a focus message into the GLM-compatible prompt path.
- Telegram living replies pass the current Telegram message as focus.
- `BuildHumanLikePrompt` separates `current turn focus` from `recent transcript`.
- Rule fallback prefers explicit focus over transcript history.
- QQ living runtime now builds a `TurnEnvelope` for the active focus message.
- QQ living runtime now uses a speaker gate so ordinary/direct messages select one public speaker.
- Explicit round requests remain allowed to produce ordered multi-speaker behavior.
- User correction/dissatisfaction turns select CEO as the single public responder.
- Telegram living output now exposes `turn_id`, `message_id`, and `reply_budget` in memory metadata for gateway verification.

This is necessary but not sufficient. It fixes the prompt contract and the first public speaker gate for QQ living runtime. Telegram still needs channel-level one-message/one-turn dedupe once the n8n wrapper normalization work lands.

## Mature Systems To Clone

### 1. Microsoft Bot Framework TurnContext

Reference:

- https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-activity-processing
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.bot.builder.turncontext

What to clone:

- one incoming activity defines one turn
- turn context carries activity, conversation, sender, reply channel, and turn-scoped state
- handlers reply to the current activity, not to every historical activity

Mortis adaptation:

```text
Incoming channel message
-> TurnEnvelope
-> one selected route
-> one reply/action set
-> timeline event
```

Do not clone:

- Bot Framework hosting stack
- Azure channel infrastructure
- SDK-heavy activity type hierarchy

### 2. AutoGen GroupChat Speaker Selection

Reference:

- https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/selector-group-chat.html
- https://microsoft.github.io/autogen/stable/reference/python/autogen_agentchat.teams.html

What to clone:

- explicit participant list
- speaker selection policy
- termination conditions
- role-based turn taking
- agents do not all answer every message

Mortis adaptation:

```text
TurnEnvelope
-> SpeakerGate
-> selected speaker(s)
-> reply/action
```

Speaker gate should choose one default public speaker for ordinary messages. Multi-speaker mode must be explicit, such as `round`, `review`, or `debate`.

Do not clone immediately:

- full AutoGen runtime
- Python team execution loop as production core
- autonomous agent chatter without artifact/task boundaries

### 3. Rasa Dialogue Policy

Reference:

- https://rasa.com/docs/rasa/policies/
- https://rasa.com/docs/rasa/conversation-driven-development/

What to clone:

- recent history is state for policy decisions
- policy predicts the next action
- history is not a checklist of messages to answer

Mortis adaptation:

```text
recent transcript + current turn + runtime state
-> predicted next public action
```

Do not clone:

- NLU slot/entity pipeline
- training-data-heavy assistant workflow

### 4. Chatwoot Conversation Ownership

Reference:

- https://www.chatwoot.com/features/shared-inbox
- https://www.chatwoot.com/features/channels

What to clone:

- channel messages belong to a conversation
- assignment/ownership prevents everyone replying at once
- status separates open, pending, resolved

Mortis adaptation:

```text
conversation_thread
-> assigned speaker / role owner
-> current turn
-> reply/action/artifact
```

Do not clone:

- customer support UI as Mortis source of truth
- inbox CRUD model as agent runtime core

### 5. LangGraph Supervisor / Swarm

Reference:

- https://langchain-ai.github.io/langgraph/concepts/multi_agent/
- https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/

What to clone later:

- durable graph execution
- supervisor handoff
- checkpoint/resume
- human approval interrupt

Mortis adaptation later:

```text
TurnEnvelope
-> SupervisorGraph
-> role handoff
-> approved action
-> artifact
-> Telegram projection
```

Do not clone now:

- full LangGraph migration before Mortis has stable turn, artifact, mailbox, and approval primitives

## Recommended Clone Strategy

Do not start by importing a full framework.

The fastest stable path is to clone the mature shapes, not the whole runtime:

```text
P0: Bot Framework TurnContext shape
P1: AutoGen speaker selection shape
P2: Chatwoot conversation ownership shape
P3: LangGraph supervisor/handoff after A2A primitives stabilize
```

Reason:

- Mortis already has Go backend, QQ living runtime, Telegram gateways, role router, Builder/Tester dispatcher, and artifact/report chains.
- Replacing the core with a Python agent framework now would create a second source of truth.
- The immediate bug is turn selection, not lack of agent framework.

## Mortis Runtime Primitives

### TurnEnvelope

Minimum structure:

```json
{
  "turn_id": "telegram:<chat-id>:<message-id>",
  "channel": "telegram",
  "conversation_key": "telegram:chat:<chat-id>",
  "actor_id": "<telegram-user-id>",
  "message_id": "<telegram-message-id>",
  "text": "你为什么一次性回复好几条之前的问题",
  "focus_policy": "latest_message",
  "reply_budget": 1,
  "created_at": "2026-05-09T12:40:00Z"
}
```

Rules:

- one external message creates one turn
- `turn_id` must be stable enough for dedupe
- recent transcript is context, never the reply target
- reply budget defaults to one public reply

### SpeakerGate

Minimum decision:

```json
{
  "turn_id": "...",
  "selected_speaker": "ceo",
  "mode": "single",
  "reason": "user correction should receive one short direct reply",
  "suppressed_speakers": ["builder", "tester", "watcher"]
}
```

Default rules:

- ordinary chat: one speaker
- dissatisfaction/correction: CEO or addressed agent, short reply
- code/test task: route to role action; public reply is acknowledgement only
- explicit `round` / `大家都说一下`: allow ordered multi-speaker flow
- bot/self/system messages: no public reply unless directly addressed by human or role handoff

### ReplyPolicy

Minimum rules:

- answer the current focus only
- do not re-answer previous questions unless user explicitly asks for recap
- avoid repeated capability boilerplate
- short direct reply for dissatisfaction
- execution details only when latest user message asks for execution or asks Mortis to do work

### ConversationOwnership

Minimum fields:

```json
{
  "conversation_key": "telegram:chat:<chat-id>",
  "owner_role": "ceo",
  "status": "open",
  "last_turn_id": "...",
  "cooldown_until": "..."
}
```

Use this to prevent multiple agents from replying to the same ordinary message.

## Implementation Plan

### Phase 1: TurnEnvelope Contract

Status: implemented for QQ living runtime; Telegram living can reuse the same primitive after channel wrapper normalization is merged.

Files likely involved:

- `server/internal/qqagents/runtime.go`
- `server/internal/handler/telegram_living.go`
- `server/internal/handler/telegram_gateway.go`
- new tests under `server/internal/qqagents/`

Tasks:

1. Add a `TurnEnvelope` type near the living runtime boundary.
2. Build one envelope for Telegram living messages.
3. Build one envelope for QQ living messages inside `tick` after `latestFocusMessage`.
4. Pass `TurnEnvelope` or its focus fields into `ChatRequest`.
5. Keep `ChatRequest.Focus` as the model-facing projection.

Exit criteria:

- tests prove one current message produces one focus
- tests prove turn id uses stable message identity
- duplicate Telegram message id does not create a second turn
- prompt still includes recent transcript as context only

### Phase 2: SpeakerGate

Status: implemented for QQ living runtime default speaker selection.

Tasks:

1. Add `SpeakerDecision` with selected role(s), mode, reason, and suppressed roles.
2. Replace direct `speakingAgents(thoughts, recent)` selection with `SpeakerGate.Decide(...)`.
3. Default ordinary messages to one public speaker.
4. Keep explicit round/workflow modes as exceptions.
5. Add tests for dissatisfaction, ordinary chat, direct role mention, and explicit round.

Exit criteria:

- complaint/correction message selects CEO as one speaker
- ordinary message selects at most one speaker
- explicit round can select ordered multi-speaker workflow
- bot messages do not trigger a public reply loop

### Phase 3: Telegram Group Policy

Tasks:

1. Add Telegram metadata for `message_id`, `chat_id`, `reply_to_message_id`, and group topic/thread id where available.
2. Ensure Telegram living gateway returns at most one reply per incoming message.
3. Add a short reply style for complaints/corrections.
4. Make n8n send only `reply.text`, never iterate over historical replies.

Exit criteria:

- the observed complaint conversation receives a short current-turn answer
- no repeated `能干活，不用@` boilerplate unless current message asks capability
- completion notifier remains separate from living reply

### Phase 4: A2A / LangGraph Later

Only after Phases 1-3 are stable:

1. Map speaker decisions to delegation events.
2. Add mailbox/artifact links.
3. Experiment with AutoGen or LangGraph in a sidecar worker.
4. Keep Mortis DB/artifacts/timeline as source of truth.

## Directly Cloneable Options

### Option A: n8n + Mortis Turn Runtime

Best for now.

Use n8n only for Telegram ingress/egress. Mortis owns turn, speaker, artifacts, and execution.

Pros:

- minimal production disruption
- fits current deployment
- easy to reproduce

Cons:

- n8n cannot become the source of conversation truth

### Option B: grammY Native Adapter

Use later when n8n workflow stabilizes.

Pros:

- mature Telegram framework
- middleware/session/conversation support
- good TypeScript ecosystem

Cons:

- introduces Node service
- still need Mortis-owned turn/speaker policy

### Option C: AutoGen Sidecar

Use for experiments in agent-to-agent group discussion.

Pros:

- mature group-chat agent patterns
- speaker selection is close to Mortis needs

Cons:

- Python sidecar
- can become a second runtime truth if adopted too early

### Option D: LangGraph Sidecar

Use after A2A primitives exist.

Pros:

- durable graph/handoff/checkpoint model
- fits approved action and human-in-loop flows

Cons:

- too heavy for the current “answer only current turn” bug

## Decision

Implement Mortis-native TurnEnvelope and SpeakerGate first, cloning Bot Framework and AutoGen shapes.

Do not import a full multi-agent framework into production until:

- turn focus is stable
- speaker gate is stable
- artifact store is stable
- mailbox/delegation events exist
- Telegram/QQ/Web share a conversation model
