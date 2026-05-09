# AstrBot

## Repository

- Upstream: https://github.com/AstrBotDevs/AstrBot
- Mortis-owned fork: https://github.com/emptyinkpot/AstrBot
- Server deployment inspected: `ubuntu@124.220.233.126:/srv/astrbot`

## Why AstrBot Matters

AstrBot is a mature open-source personal and group-chat agent shell. It already owns several primitives that Mortis should not hand-roll from scratch:

- multi-platform IM adapters
- WebUI-based bot configuration
- plugin/star ecosystem
- command and event hook routing
- knowledge base and retrieval tooling
- MCP/tool management UI
- session management
- group-chat memory and active reply behavior
- built-in webchat projection

Mortis should treat AstrBot as a mature channel/chatbot product shell, not as the Mortis Core replacement.

## Observed Server State

As of 2026-05-09, the Mortis server has AstrBot deployed:

```text
container: astrbot
image: soulter/astrbot:latest
version: v4.24.2
source path: /srv/astrbot
data mount: /srv/astrbot/data -> /AstrBot/data
WebUI port in container: 6185
```

Observed configuration:

- `platform: []`, so this deployed instance is not yet connected to QQ/Telegram platforms.
- `provider: []`, so this deployed instance is not yet configured as the active Mortis chat brain.
- `dashboard.enable: true`, WebUI is available in the container.
- `mcpServers: {}`, MCP is supported but no server is configured in the inspected runtime.

## Referenced Concepts

- channel adapter registry
- unified platform webhook route
- plugin/star handler lifecycle
- plugin marketplace and plugin page model
- dashboard-managed platform/provider/plugin configuration
- knowledge base ingestion and retrieval tools
- MCP server CRUD and test flow
- long-term group-chat memory hooks
- active reply probability and whitelist controls
- proactive message support metadata
- built-in command and permission filters

## Referenced Areas In Mortis

AstrBot should influence these Mortis layers:

- Telegram / QQ / Web channel projection
- living-agent group-room behavior
- plugin-like extension boundary for channel features
- MemoryAdapter and knowledge-base boundary
- tool/MCP management surface
- operator cockpit UI design
- social bot configuration and session management

## NOT Copied

Mortis does not copy AstrBot as its operator core.

Mortis does not delegate these responsibilities to AstrBot:

- source-of-truth workspace state
- approved action policy
- Builder / Tester execution chain
- Git worktree policy
- artifacts and verification evidence
- deployment decisions
- A2A mailbox and delegation records
- operator timeline truth

## Differences

AstrBot is:

- chatbot-shell first
- IM-platform first
- plugin/WebUI oriented
- group-chat assistant oriented
- useful as an integration surface

Mortis is:

- operator-runtime first
- artifact and approval oriented
- engineering execution oriented
- shared workspace / timeline / A2A oriented
- source-of-truth for private AI operations

## Integration Direction

The preferred integration is adapter-based:

```text
Telegram / QQ / Web
-> AstrBot or n8n channel shell
-> Mortis Gateway Adapter
-> Mortis Core
-> Builder / Tester / Artifacts / Timeline
-> channel projection
```

AstrBot can own channel-specific bot ergonomics and plugin UI. Mortis must keep runtime authority.

## Upstream Contribution Rule

Changes that improve AstrBot generally should be developed against the Mortis-owned fork and proposed upstream:

```text
AstrBotDevs/AstrBot upstream
-> emptyinkpot/AstrBot fork
-> feature branch
-> PR to AstrBotDevs/AstrBot
```

Do not make long-lived private changes directly in `/srv/astrbot`. The server directory is a deployment checkout, not the collaboration source of truth.
