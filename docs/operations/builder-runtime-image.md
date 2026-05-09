# Builder Runtime Image

Mortis keeps the backend container focused on API/runtime coordination. Code execution should move to a dedicated Builder image and be enabled with `MORTIS_BUILDER_CONTAINER_IMAGE`.

## Image

Build from the repository root:

```bash
docker build -f docker/builder-runtime.Dockerfile -t mortis-builder-runtime:latest docker
```

Required tools in this image:

- `bash`
- `git`
- `ssh`
- `curl`
- `make`
- `go`
- `node` / `npm`
- `pnpm`
- `codex`


## Toolchain Contract

The Builder image must match the repository toolchain, not the host package default.

Required baseline:

- Go `1.26.1` or newer for `server/go.mod`
- Codex CLI matching the backend invocation contract
- pnpm for workspace checks

Operational note from 2026-05-09: installing Go through Alpine `apk` produced `go1.25.9`, which blocked `go test ./internal/roles`. The Builder image now uses `golang:1.26-alpine`, installs Node/npm separately, and symlinks `go`/`gofmt` into `/usr/local/bin` so the toolchain survives container PATH overrides.

Verification command:

```bash
docker run --rm mortis-builder-runtime:latest
docker run --rm -v /srv/multica/server:/workspace -w /workspace mortis-builder-runtime:latest sh -lc "go test ./internal/roles"
```

Do not mark Builder image rollout complete unless these commands pass on the private Mortis host.

## Enable

Set in production `.env` only after the image exists on the host:

```bash
MORTIS_BUILDER_CONTAINER_IMAGE=mortis-builder-runtime:latest
```

When enabled, Builder actions run Codex inside the container with:

- `/workspace` mounted to the action workspace root
- `/root/.codex` mounted from `MORTIS_CODEX_HOME` when configured
- working directory set to `/workspace/repo`

The backend still owns dispatch, artifact persistence, and action status updates. The Builder image owns repository command execution.

## Current Production Note

On `ubuntu@124.220.233.126:/srv/multica`, Alpine package downloads can be very slow. If building this image on the host stalls in `apk add`, build it in CI or another stable network environment, then push/load it onto the server before setting `MORTIS_BUILDER_CONTAINER_IMAGE`.

## Docker socket access

When `MORTIS_BUILDER_CONTAINER_IMAGE` is enabled, the backend dispatcher launches the Builder image with `docker run`. The backend container therefore needs:

- `docker-cli` installed in the backend image
- `/var/run/docker.sock:/var/run/docker.sock` mounted in `docker-compose.selfhost.yml`

This is a privileged operational boundary. Only enable it on the private Mortis host where Builder actions are already trusted to run approved repository work.

## Rollout Plan

### Phase 1: Container Execution Wiring

Goal: make the existing Builder runtime able to launch the dedicated Builder image from the backend container.

Tasks:

1. Keep execution tools in `docker/builder-runtime.Dockerfile`.
2. Keep the backend image focused on API/dispatcher work, but install `docker-cli` so it can call the host daemon.
3. Mount `/var/run/docker.sock` into the backend container only on the private Mortis host.
4. Build and verify the image on the host:

```bash
docker build -f docker/builder-runtime.Dockerfile -t mortis-builder-runtime:latest docker
docker run --rm mortis-builder-runtime:latest
```

5. Recreate the backend container and verify from inside it:

```bash
docker version
docker images | grep mortis-builder-runtime
```

Exit criteria:

- backend container can run `docker version`
- `mortis-builder-runtime:latest` exists on the host
- policy check and backend tests pass

### Phase 2: Telegram Execution Loop Proof

Goal: prove Telegram is not only an input surface but a closed operator cockpit.

Test flow:

```text
Telegram natural language
-> /api/telegram/operator-message
-> Role Router
-> approved Builder action
-> Builder container execution
-> execution_report
-> Telegram completion notifier
```

Exit criteria:

- Telegram receives the initial route acknowledgement
- Builder creates a real action workspace
- execution_report contains runtime, branch, changed files, logs, and status
- Telegram receives completion or failure notification

### Phase 3: Group Chat Turn Policy

Status: first runtime primitive implemented for GLM/living replies.

Implemented:

- `ChatRequest.Focus` carries the current external message for the active turn.
- QQ living replies and Telegram living replies pass the focus message into the GLM-compatible prompt path.
- `BuildHumanLikePrompt` now separates the current turn focus from recent transcript context.
- Rule-based fallback also prefers explicit turn focus over transcript history.

Still pending:

- speaker gate / cooldown for future multi-agent Telegram group chat
- channel-level dedupe of one reply per external Telegram message after native adapter exists
- production observation against the real Telegram group after notifier credentials are configured

Goal: fix the observed problem where Mortis answers old questions together instead of replying to the latest turn.

Required runtime rules:

- one incoming external message id maps to at most one living reply
- default reply target is the latest user message, not the whole recent transcript
- recent transcript is context only, not a checklist of questions to answer
- user dissatisfaction or correction gets a short direct reply
- ordinary chat replies should be short unless the user asks for detail
- execution-chain explanations are only included when the user asks about execution or asks Mortis to do work
- future multi-agent chat must use speaker gating and cooldown, not free-for-all replies

Implementation target:

```text
QQ / Telegram message
-> Turn Envelope
-> Speaker Gate
-> Latest-message Reply Policy
-> Living Reply / Role Router
-> one reply
```

Mature patterns to reuse:

- Microsoft Bot Framework `TurnContext`: one incoming activity defines the current turn
- Rasa dialogue policies: history is context, not the full reply target list
- Chatwoot conversation ownership: channel messages belong to a conversation with assignment/status
- LangGraph supervisor/swarm: future multi-agent handoff after Mortis has stable A2A primitives

Exit criteria:

- when the user says “你为什么一次性回复好几条之前的问题”, Mortis answers only that complaint
- no repeated “能干活，不用@” boilerplate unless the latest user message asks for capability
- multi-agent mode can later add speakers without every agent responding to every historical topic


## Phase 2 Validation Result - 2026-05-09

Observed proof action:

```text
Action: 332acc2f-37a1-4067-a801-62218b385942
Invocation: c34d9ee4-da57-48e8-b4a0-626e652601e0
Runtime: builder-local-codex
Status: completed
Commit: cb9353e770bb2b95aefab93b0c82dbcb69c3d9ec
Changed files: docs/operations/telegram-builder-loop-proof.md
```

Validated chain:

```text
Telegram-shaped operator-message
-> Role Router
-> Builder AI / code_change
-> approved action
-> backend dispatcher
-> mortis-builder-runtime container
-> execution_report
```

The Builder container path is working. The proof created a real action workspace under `agent-workspaces/`, ran repository policy preflight, executed Codex in `mortis-builder-runtime:latest`, and produced a commit plus changed file evidence.

Remaining blocker:

```text
Telegram completion notification is not yet validated because production .env currently does not provide TELEGRAM_BOT_TOKEN or MORTIS_TELEGRAM_NOTIFY_CHAT_ID to the backend container.
```

Required next configuration:

```env
MORTIS_TELEGRAM_NOTIFY_ENABLED=true
TELEGRAM_BOT_TOKEN=<bot-token>
MORTIS_TELEGRAM_NOTIFY_CHAT_ID=<fallback-chat-id>
```

After setting those values, recreate backend and confirm:

```bash
docker compose -f docker-compose.selfhost.yml up -d --no-deps backend
docker compose -f docker-compose.selfhost.yml exec -T backend printenv TELEGRAM_BOT_TOKEN | wc -c
docker compose -f docker-compose.selfhost.yml exec -T backend printenv MORTIS_TELEGRAM_NOTIFY_CHAT_ID | wc -c
```

Then trigger another Telegram Builder task and verify `telegram_notified_at=true` in `role_invocations.result`.
