# System Topology

Mortis should be understood as an Operator Bus, not as a collection of bot integrations.

## Runtime Map

```text
QQ / Telegram / Web / Scheduler / GitHub
-> Channel Adapter
-> Unified Operator Event
-> Mortis Core
-> Dispatcher
-> Agent Runtime
-> Artifacts
-> Timeline / Evidence / Approval
-> Reply Projection
-> QQ / Telegram / Web
```

## Current Production Roots

| Surface | Value |
| --- | --- |
| Source / runtime root | `ubuntu@124.220.233.126:/srv/multica` |
| Public app | `https://mortis.tengokukk.com` |
| Agent OS cockpit | `https://mortis.tengokukk.com/mortis/agent-os` |
| n8n gateway UI | `https://mortis.tengokukk.com/n8n/` |
| Backend bind | `127.0.0.1:8088` |
| Frontend bind | `127.0.0.1:3300` |

## Channel Roles

### Web

Web is the operator cockpit and preferred source-of-truth surface.

### Telegram

Telegram is a mobile operator cockpit projection. The current prototype path is:

```text
Telegram
-> n8n webhook
-> Mortis Operator Event API
-> Telegram webhook response
```

### QQ

QQ / NapCat is a legacy and optional gateway. QQ instability should not block Mortis Core operation.

### n8n

n8n is an automation gateway and workflow prototype layer. It should not become the source of truth for command semantics.

## Operating Rule

When a channel fails, check Mortis Core first, then the channel adapter. Do not turn provider login problems into core architecture changes.
