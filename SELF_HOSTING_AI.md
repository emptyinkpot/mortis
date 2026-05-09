---
title: Self-Hosting Setup for AI Agents
status: compatibility-supporting
audience: ai agents and operators
scope: generic ai-executable self-host quick path
sourceDoc: SELF_HOSTING.md
---

# Self-Hosting Setup (for AI Agents)

This document is designed for AI agents to execute. Follow these steps exactly
to deploy a local Multica instance and connect to it.

> Scope note: this file is an AI-oriented helper for the generic self-host path.
> It is not the source of truth for the current Mortis private production
> deployment. For current Mortis-branded runtime facts, use
> `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`.

## Role In The Doc Stack

- `README.md` defines current Mortis project truth and entrypoints
- `project.json` is the machine-readable project entry
- `SELF_HOSTING.md` defines the generic self-host workflow
- this file is the AI-executable shortcut for that generic self-host workflow
- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` records current Mortis private runtime facts

If this file conflicts with `README.md`, `project.json`, or
`MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` about the current private deployment,
those current-state documents win.

## Current Boundary

- This file may optimize generic self-host execution steps for AI agents.
- This file should not be treated as the canonical description of the current
  Mortis private deployment.
- Default localhost examples here describe generic self-host behavior, not the
  current Mortis private production binds.

## Prerequisites

- Docker and Docker Compose installed
- Homebrew installed (for CLI)
- At least one AI agent CLI on PATH: `claude` or `codex`

## Install

```bash
# Install CLI + provision self-host server
curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash -s -- --with-server

# Configure CLI for localhost, authenticate, and start daemon
multica setup self-host
```

Wait for the server output `✓ Multica server is running and CLI is ready!` before running `multica setup self-host`.

**Expected result:**
- Frontend at http://localhost:3000
- Backend at http://localhost:8080
- `multica` CLI installed and configured for localhost

## Alternative: Manual Setup

```bash
git clone https://github.com/multica-ai/multica.git
cd multica
make selfhost
brew install multica-ai/tap/multica
multica setup self-host
```

The `multica setup self-host` command will:
1. Configure CLI to connect to localhost:8080 / localhost:3000
2. Open a browser for login — use verification code `888888` with any email
3. Discover workspaces automatically
4. Start the daemon in the background

## Verification

```bash
multica daemon status
```

Should show `running` with detected agents.

## Stopping

```bash
# Stop the daemon
multica daemon stop

# Stop all Docker services
cd multica
make selfhost-stop
```

## Custom Ports

If the default ports (8080/3000) are in use:

1. Edit `.env` and change `PORT` and `FRONTEND_PORT`
2. Run `make selfhost`
3. Run `multica setup self-host --port <PORT> --frontend-port <FRONTEND_PORT>`

## Troubleshooting

- **Backend not ready:** `docker compose -f docker-compose.selfhost.yml logs backend`
- **Frontend not ready:** `docker compose -f docker-compose.selfhost.yml logs frontend`
- **Daemon issues:** `multica daemon logs`
- **Health check:** `curl http://localhost:8080/health`

## Relationship To Mortis Private Deployment

- Use this file for AI-executable generic self-host setup.
- Use `SELF_HOSTING.md` for the primary generic self-host guide.
- Use `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` for current Mortis private runtime
  facts, domains, ports, and operator shortcuts.
