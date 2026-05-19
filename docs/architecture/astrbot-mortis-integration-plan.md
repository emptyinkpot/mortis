# AstrBot + Mortis Integration Plan

Mortis and AstrBot should be fused through explicit product boundaries, not by mixing source trees or turning the server deployment checkout into a private fork.

## Company-Grade Pattern

Mature engineering organizations usually manage cooperating systems with these layers:

| Layer | Purpose | Mortis/AstrBot Decision |
| --- | --- | --- |
| Upstream project | External canonical source | `AstrBotDevs/AstrBot` remains upstream |
| Owned fork | Place for patches intended for upstream contribution | `emptyinkpot/AstrBot` |
| Product integration repo | Owns private business runtime and adapters | `emptyinkpot/mortis` |
| Deployment checkout | Runs production, not source-of-truth development | `/srv/astrbot`, `/srv/multica` |
| Adapter boundary | Stable interface between products | Mortis Gateway / AstrBot plugin |
| Vendor policy | Tracks version, patches, license, update strategy | docs + ADRs |

This prevents the common failure mode where a production directory accumulates unreviewed edits that cannot be upgraded or contributed upstream.

## Source Ownership

```text
AstrBotDevs/AstrBot
  upstream product

emptyinkpot/AstrBot
  Mortis-owned fork for AstrBot patches and PRs

emptyinkpot/mortis
  Mortis Core, operator policy, adapter specs, deployment docs

/srv/astrbot
  running deployment checkout only

/srv/multica
  Mortis remote source-of-truth and deployment workspace
```

## What To Reuse From AstrBot

Reuse or adapt these mature primitives instead of hand-rolling them:

- platform adapter registry
- Telegram / QQ / Slack / Mattermost / Discord channel adapters
- WebUI configuration surface
- plugin/star event lifecycle
- plugin market/install/update model
- command filters and permission filters
- session management
- knowledge base UI and retrieval tools
- MCP server management UI
- long-term group-chat memory hooks
- active reply controls
- proactive message metadata

## What Mortis Keeps

Mortis must remain source of truth for:

- operator identity and permissions
- action approval
- Builder/Codex execution
- Tester verification
- artifact store and reports
- timeline events
- A2A mailbox and delegation graph
- Git worktree policy
- deployment decisions

## Recommended Fusion Architecture

### Option A: AstrBot As Channel Shell

```text
Telegram / QQ / WebChat
-> AstrBot platform adapter
-> Mortis Adapter Plugin
-> Mortis Gateway API
-> Mortis Core
-> artifact/timeline response
-> AstrBot sends message back to chat
```

Use this when the priority is mature IM behavior, WebUI platform setup, group chat memory, and plugin ecosystem.

### Option B: n8n As Gateway, AstrBot As Reference Runtime

```text
Telegram
-> n8n
-> Mortis Gateway API
-> Mortis Core
```

Use this while Telegram network egress and current n8n webhook mode are still being stabilized.

### Option C: Hybrid

```text
QQ / group chat / plugin experiments -> AstrBot
Telegram operator cockpit -> n8n/Mortis
Engineering execution -> Mortis Builder/Tester
```

This is the safest near-term path. It avoids forcing all channels through one tool before the runtime boundaries are stable.

## Fork And Upstream Contribution Workflow

1. Keep the fork synced:

```bash
gh repo fork AstrBotDevs/AstrBot --clone=false --default-branch-only
```

Current fork:

```text
https://github.com/emptyinkpot/AstrBot
```

2. For AstrBot changes, work in the fork, not `/srv/astrbot`:

```bash
git clone https://github.com/emptyinkpot/AstrBot.git
cd AstrBot
git remote add upstream https://github.com/AstrBotDevs/AstrBot.git
git fetch upstream
git checkout -b feature/mortis-gateway-adapter upstream/master
```

3. Keep patches upstreamable:

- small scope
- no Mortis secrets
- no private domain assumptions
- configurable endpoints
- tests or docs when applicable
- compatible with AstrBot's style and license

4. Submit PR upstream:

```text
emptyinkpot/AstrBot feature branch
-> PR to AstrBotDevs/AstrBot master
```

5. If a patch is Mortis-private, keep it in Mortis as an adapter or deployment overlay instead of patching AstrBot core.

## First Upstreamable Patch Candidates

### 1. Generic HTTP Gateway Plugin

A plugin that forwards selected AstrBot events to an external HTTP gateway and sends the gateway response back to the platform.

Why it is upstreamable:

- useful beyond Mortis
- configurable endpoint and headers
- fits AstrBot plugin model
- does not hard-code Mortis

Mortis usage:

```text
AstrBot message event
-> HTTP Gateway Plugin
-> Mortis /api/telegram/living-message or /api/operator-events
-> AstrBot reply
```

### 2. Webhook/Gateway Documentation

Document how to connect AstrBot to an external operator runtime such as Mortis, n8n, Dify, Coze, or custom services.

Why it is upstreamable:

- improves AstrBot integration docs
- low risk
- does not change runtime behavior

### 3. Safer Deployment Compose Defaults

The server deployment changed AstrBot compose ports to bind on localhost:

```text
127.0.0.1:6185:6185
127.0.0.1:6199:6199
```

This may be upstreamable as documentation or an optional hardened compose variant, not necessarily as the default.

## Mortis-Side Implementation Plan

### P0: Record AstrBot As Reference Architecture

- `docs/reference-architecture/astrbot.md`
- update `docs/reference-architecture/README.md`
- update mature systems adoption plan

### P1: Define Mortis Gateway Contract For Bot Shells

Create a channel-shell contract that any bot framework can call:

```json
{
  "channel": "telegram|qq|webchat|astrbot",
  "conversation_id": "...",
  "actor_id": "...",
  "text": "...",
  "message_id": "...",
  "attachments": [],
  "reply_mode": "living|operator|status"
}
```

Response:

```json
{
  "reply_text": "...",
  "actions": [],
  "artifact_refs": [],
  "timeline_refs": []
}
```

### P2: Build Generic AstrBot Plugin In Fork

Build it as a generic external gateway plugin. Name and docs should not depend on Mortis.

Suggested name:

```text
astrbot_plugin_http_gateway
```

### P3: Connect Plugin To Mortis In Deployment

Configure `/srv/astrbot/data` to call Mortis gateway endpoints through secrets outside Git.

### P4: Upstream PR

After local smoke proves the plugin works, open a PR from `emptyinkpot/AstrBot` to `AstrBotDevs/AstrBot`.

## Non-Goals

- Do not merge AstrBot source into Mortis source.
- Do not turn `/srv/astrbot` into the long-term private fork.
- Do not let AstrBot bypass Mortis approval/execution policy.
- Do not put Mortis secrets into the AstrBot fork.
- Do not block current n8n Telegram mode on AstrBot integration.

## Implementation Status

Initial plugin repository created:

```text
https://github.com/emptyinkpot/astrbot_plugin_external_gateway
```

Initial commit:

```text
b1b9ec4 feat: add external gateway plugin
```

The plugin is intentionally independent from AstrBot Core and exposes a generic external HTTP runtime gateway. It can be installed into AstrBot through `data/plugins/` and configured from AstrBot WebUI.

## Immediate Next Move

Smoke the plugin inside the deployed AstrBot instance against a local test gateway, then configure it against a Mortis gateway endpoint. After smoke succeeds, submit it to the AstrBot plugin marketplace and consider a small upstream docs PR from `emptyinkpot/AstrBot`.
