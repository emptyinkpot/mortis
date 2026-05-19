# Current Runtime Map

This document records where Mortis is currently edited, deployed, and integrated.

It is a factual operations map, not a secret store. Do not put tokens, passwords, session cookies, or bot secrets in this file.

## Source Of Truth

| Surface | Value | Notes |
| --- | --- | --- |
| GitHub repository | `https://github.com/emptyinkpot/mortis` | Canonical remote Git repository. |
| Default branch | `mortis/operator-runtime` | Production-facing source changes are pushed here. |
| Local source root | none | Local checkout `E:\My Project\Mortis` was deleted and retired; future local clones are synchronized copies only. |
| Remote source root | `ubuntu@124.220.233.126:/srv/multica` | Remote-first working tree used for production-side edits and deployment checks. |
| Production runtime root | `/srv/multica` | Same path as the remote source root today. |
| Upstream runtime foundation | `https://github.com/multica-ai/multica` | Mortis is built on the Multica runtime foundation. |

## Public URLs

| Surface | URL | Notes |
| --- | --- | --- |
| Mortis app | `https://mortis.tengokukk.com` | Current public entry. |
| Mortis about | `https://mortis.tengokukk.com/about` | Public about page. |
| n8n gateway UI | `https://mortis.tengokukk.com/n8n/` | Primary Telegram automation UI; workflow definitions may live in n8n state, not Git, unless exported. |
| Legacy redirect host | `https://golutra.tengokukk.com` | Historical redirect entry. |

## Private Runtime Binds

| Service | Bind | Notes |
| --- | --- | --- |
| Backend | `127.0.0.1:8088` | Private production backend bind. |
| Frontend | `127.0.0.1:3300` | Private production frontend bind. |

## Current Operator Gateway

| Item | Value |
| --- | --- |
| Operator event API | `POST /api/operator-events?workspace_slug=mortis` |
| Primary command verified | `/status` |
| Auth modes | `X-User-ID` for local/operator trust path; gateway secret headers in private deployment |
| Gateway secret headers | `X-Mortis-Operator-Secret`, `X-Operator-Gateway-Secret` |
| Telegram gateway prototype | n8n workflow projects Telegram updates into Mortis operator events |
| Telegram operator gateway runbook | `docs/operations/telegram-operator-gateway.md` |


## Channel Priority

| Channel | Status | Operational meaning |
| --- | --- | --- |
| Telegram | primary | Main mobile operator surface through n8n and Mortis Operator Event API. |
| Web | primary | Source-of-truth cockpit and inspection surface. |
| n8n | gateway | Automation bridge for Telegram and webhook workflows. |
| QQ / NapCat | legacy optional | Compatibility/notification adapter only; do not treat QQ outages as core runtime outages. |

## n8n Boundary

n8n is currently an automation gateway and prototyping layer.

Current n8n facts:

- Deployed behind `https://mortis.tengokukk.com/n8n/`
- Uses the Chinese image `blowsnow/n8n-chinese`
- Contains workflows such as `Mortis Gateway Smoke Test` and `Mortis Telegram Operator`
- Telegram setup and replication steps are recorded in `docs/operations/telegram-operator-gateway.md`
- Routes Telegram webhook input through Mortis Core instead of owning command semantics

n8n is not the source of truth for Mortis runtime state. Long-term command semantics belong in Mortis Core.

## Recent Codex-Driven Repository Changes

These commits were made through the remote-first workflow and pushed to GitHub:

| Commit | Purpose |
| --- | --- |
| `725eda6` | Add operator event ingest API. |
| `39c3241` | Align operator gateway secret environment usage. |
| `55c68a4` | Allow operator event gateway secret header. |
| `eadbb43` | Define Agent Society Runtime reference architecture. |

## Git / Deployment Workflow

The current preferred workflow is:

```text
edit /srv/multica on 124.220.233.126
-> validate remotely
-> commit in /srv/multica
-> push to GitHub mortis/operator-runtime
-> sync E:\My Project\mortis to origin/mortis/operator-runtime
```

When a change is made directly in the local checkout, push it to GitHub and fast-forward `/srv/multica` before treating it as deployed.

## Runtime Directories Not Tracked In Git

These directories may appear in `/srv/multica` and should not be added to commits:

- `agent-workspaces/`
- `openlist-export/`

They are runtime state, not repository source.

