# Telegram Operator Gateway

本文定义 Mortis Telegram 机器人的第一阶段实现方式：Telegram 只做 mobile operator cockpit / channel projection，命令语义仍归 Mortis Core。

不要把 Telegram bot token、n8n credential、Mortis gateway secret 写进 Git。

> 重要：如果 bot token 曾经贴到聊天、日志、截图或公开仓库里，应先到 BotFather 重新生成 token，再继续配置。

## Current Architecture

Target durable architecture:

```text
Telegram Bot
-> n8n Telegram Trigger
-> n8n HTTP Request
-> Mortis Telegram Natural Language Gateway
-> n8n Telegram Send Message
-> Telegram chat
```

Current deployed prototype as of 2026-05-09:

```text
Telegram Bot webhook
-> n8n Webhook path: mortis-telegram-operator
-> n8n HTTP Request
-> Mortis Telegram Natural Language Gateway
-> n8n webhook JSON response: { method: sendMessage, chat_id, text }
-> Telegram chat
```

The durable target is still Telegram Trigger plus Telegram Send Message, because it is easier to inspect and less dependent on Telegram webhook response shape. The prototype can receive and ingest events, but group replies may fail silently if Telegram does not accept the webhook response body shape or if group privacy prevents the bot from receiving ordinary messages.

Related roadmap:

```text
docs/architecture/telegram-agent-roadmap.md
```

The roadmap records the mature systems to clone from, the n8n-first plan, the GLM living-agent path, and the later native Telegram / Agent Society phases.

Mortis natural-language endpoint:

```text
POST https://mortis.tengokukk.com/api/telegram/operator-message?workspace_slug=mortis
```

Legacy status endpoint:

```text
POST https://mortis.tengokukk.com/api/operator-events?workspace_slug=mortis
```

Private/local backend endpoint when testing on the host:

```text
POST http://127.0.0.1:8088/api/telegram/operator-message?workspace_slug=mortis
```

Required auth header:

```text
X-Mortis-Operator-Secret: <MORTIS_OPERATOR_EVENT_SECRET>
```

The backend also accepts:

```text
X-Operator-Gateway-Secret: <MORTIS_OPERATOR_EVENT_SECRET>
```



## n8n Telegram I/O Mode

Current production mode as of 2026-05-09:

```text
Telegram webhook
-> n8n Webhook: mortis-telegram-operator
-> Mortis /api/telegram/living-message
-> n8n last-node webhook response
-> Telegram webhook response: { method: "sendMessage", chat_id, text }
```

This is intentionally not using an n8n HTTP Request node to call `https://api.telegram.org/bot.../sendMessage` yet.

Reason observed during configuration:

- The Mortis host can receive Telegram webhook traffic through n8n.
- Direct outbound calls from the host to `https://api.telegram.org` can time out.
- n8n direct Bot API sendMessage also needs outbound Telegram API connectivity or an HTTP(S) proxy.
- n8n expression access to env vars requires `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` if `$env.TELEGRAM_BOT_TOKEN` is used.

Validated smoke on 2026-05-09:

```bash
curl -X POST http://127.0.0.1:5678/webhook/mortis-telegram-operator   -H 'Content-Type: application/json'   --data-binary @/tmp/telegram-n8n-smoke.json
```

Result:

```json
{"method":"sendMessage","chat_id":"<redacted>","text":"<glm living reply>"}
```

Operational note:

- Keep `MORTIS_TELEGRAM_NOTIFY_ENABLED=false` until either direct Telegram Bot API egress works or notifier output is projected through n8n.
- If switching to direct n8n Send Message later, first configure proxy/env and verify `./scripts/check-telegram-runtime.sh --send-test` or equivalent n8n HTTP Request smoke.

## n8n Disk Safety

During configuration on 2026-05-09, `/mnt/data` reached 100% usage because Docker/containerd build cache occupied most of the volume. n8n then failed with SQLite `SQLITE_IOERR`.

Recovery performed:

```bash
docker builder prune -af
# keep /mnt/data/n8n/database.sqlite and backups
```

After cleanup, `/mnt/data` returned to a safe usage range and n8n database `pragma integrity_check` returned `ok`.

Before editing n8n workflows or restarting n8n, check:

```bash
df -h /mnt/data
python3 -c "import sqlite3; con=sqlite3.connect('/mnt/data/n8n/database.sqlite'); print(con.execute('pragma integrity_check').fetchone()[0])"
```

## Telegram Runtime Diagnostics

Use the repository script to validate Telegram runtime without printing secrets:

```bash
./scripts/check-telegram-runtime.sh
./scripts/check-telegram-runtime.sh --send-test
```

The script reports only token/chat-id lengths, Bot API status, webhook status, and optional sendMessage result. It does not print `TELEGRAM_BOT_TOKEN`.

Observed on 2026-05-09:

```text
backend container has TELEGRAM_BOT_TOKEN and MORTIS_TELEGRAM_NOTIFY_CHAT_ID
MORTIS_TELEGRAM_NOTIFY_ENABLED=false
server direct curl to https://api.telegram.org can time out
n8n workflow is active and can receive Telegram webhook traffic
```

Implication:

- Telegram ingress should continue through n8n.
- Telegram direct completion notifier requires either server egress to Telegram Bot API or a notifier projection through n8n.
- If direct notifier is enabled, first run `./scripts/check-telegram-runtime.sh --send-test` from `/srv/multica` and confirm `sendMessage_ok=true`.

## Required Secrets

Store these outside Git:

```text
TELEGRAM_BOT_TOKEN=<from BotFather>
MORTIS_OPERATOR_EVENT_SECRET=<same value as backend .env>
MORTIS_TELEGRAM_GATEWAY_URL=https://mortis.tengokukk.com/api/telegram/operator-message?workspace_slug=mortis
```

Recommended n8n credential layout:

| Secret | Where |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | n8n Telegram credential |
| `MORTIS_OPERATOR_EVENT_SECRET` | n8n credential/env var, never hard-coded in workflow JSON |
| `MORTIS_TELEGRAM_GATEWAY_URL` | n8n workflow variable or env var |

## Telegram Bot Registration

1. Open BotFather in Telegram.
2. Run `/newbot` if the bot does not exist.
3. Copy the token once into the n8n Telegram credential.
4. Do not paste the token into repo files, issue comments, screenshots, or AI prompts.
5. If token exposure happens, run BotFather `/revoke` for that bot and replace the n8n credential.

Optional BotFather commands:

```text
/setdescription
Mortis mobile operator cockpit.

/setcommands
start - Show Mortis operator status
status - Show Mortis operator status
runtime - Show runtime summary
artifacts - Show recent artifacts
approve - Approve a pending action by id
reject - Reject a pending action by id
```

Natural language is now routed through the Role Router. GLM remains the chat/planning runtime through the existing role runtime configuration; code and test work enter the Codex-backed Builder/Tester execution chain.

## n8n Workflow

Create a workflow named:

```text
Mortis Telegram Operator
```

### Node 1: Telegram Trigger

Use the Telegram credential containing the bot token.

Recommended updates:

```text
message
edited_message
callback_query
```

For MVP, only `message.text` is required.

### Node 2: Normalize Telegram Update

Use a Set or Code node to produce this shape:

```json
{
  "event_type": "operator.command",
  "workspace": "mortis",
  "channel": "telegram",
  "conversation": {
    "id": "={{ $json.message.chat.id }}",
    "type": "={{ $json.message.chat.type }}",
    "title": "={{ $json.message.chat.title || '' }}"
  },
  "actor": {
    "external_id": "={{ $json.message.from.id }}",
    "display_name": "={{ [$json.message.from.first_name, $json.message.from.last_name].filter(Boolean).join(' ') }}",
    "username": "={{ $json.message.from.username || '' }}"
  },
  "text": "={{ $json.message.text || '' }}",
  "raw": "={{ $json }}",
  "metadata": {
    "message_id": "={{ $json.message.message_id }}",
    "date": "={{ $json.message.date }}"
  }
}
```

### Node 3: HTTP Request To Mortis

Method:

```text
POST
```

URL:

```text
{{$env.MORTIS_TELEGRAM_GATEWAY_URL}}
```

Headers:

```text
Content-Type: application/json
X-Mortis-Operator-Secret: {{$env.MORTIS_OPERATOR_EVENT_SECRET}}
```

Body:

```text
JSON from Normalize Telegram Update
```

Expected response:

```json
{
  "ok": true,
  "reply": {
    "channel": "telegram",
    "text": "Mortis 已收到 Telegram 指令。\n路由: Builder / code_change\n风险: low\n状态: approved\nAction: ...\n已进入后台 Codex 执行队列。"
  },
  "route": {
    "role_name": "builder",
    "command_type": "code_change",
    "risk_level": "low"
  },
  "invocation_id": "...",
  "action_id": "...",
  "action_status": "approved"
}
```

### Node 4: Telegram Send Message

Chat ID:

```text
={{ $('Telegram Trigger').item.json.message.chat.id }}
```

Text:

```text
={{ $json.reply.text }}
```

Parse mode:

```text
None
```

Disable web page preview:

```text
true
```

## Completion Notifier

Telegram can also receive Builder/Tester completion results directly from Mortis without waiting for n8n polling.

Enable it on the backend:

```env
MORTIS_TELEGRAM_NOTIFY_ENABLED=true
MORTIS_TELEGRAM_NOTIFY_INTERVAL_SECONDS=5
MORTIS_TELEGRAM_NOTIFY_CHAT_ID=<fallback-chat-id>
TELEGRAM_BOT_TOKEN=<bot-token>
```

For Telegram-originated role actions, Mortis reads `conversation_messages.metadata.telegram_chat_id` and sends the completion result back to that chat. `MORTIS_TELEGRAM_NOTIFY_CHAT_ID` is only a fallback for records that do not carry a Telegram chat id.

The notifier watches completed, failed, and blocked Telegram role invocations with `execution_report`, then marks them with:

```text
telegram_notified_at
telegram_notify_chat_id
```

or, when no target exists:

```text
telegram_notify_skipped_at
telegram_notify_skip_reason
```

This mirrors the QQ completion notifier and closes the Telegram operator loop:

```text
Telegram natural language
-> Role Router
-> Builder / Tester execution
-> execution_report
-> Telegram completion notification
```

## Living-Agent Gateway

A separate Telegram living-agent projection is being implemented for QQ-like natural conversation:

```text
POST https://mortis.tengokukk.com/api/telegram/living-message?workspace_slug=mortis
```

This route should be used for ordinary chat/persona replies. It reuses the existing QQ living-agent runtime, GLM-compatible model configuration, personas, and memory path. It should not become the execution source of truth; code/test work still belongs to the operator gateway and Codex-backed Builder/Tester chain.

Expected n8n shape is the same Telegram update envelope used by the operator gateway, with optional metadata:

```json
{
  "metadata": {
    "role_hint": "builder"
  },
  "message": {
    "text": "这个代码入口你怎么看",
    "chat": { "id": "<telegram-chat-id>" },
    "from": { "id": "<telegram-user-id>" }
  }
}
```

## Natural Language Support Today

Telegram messages are routed by Mortis Role Router:

| Natural language | Route | Execution |
| --- | --- | --- |
| `帮我修一下 README` | Builder / `code_change` | low-risk can auto-approve into Codex |
| `跑一下后端测试` | Tester / `test_execution` | low-risk can auto-approve into Codex verifier |
| `帮我规划这个功能` | Manager / `create_plan` | approval required |
| `部署到生产` | Manager / `deploy_production` | high-risk approval required |
| `删除/清空/drop` | Manager / destructive request | high-risk approval required |

`/status` remains supported through the legacy operator event endpoint and can later be folded into this gateway.

## Smoke Test

Send this in Telegram:

```text
/status
```

Expected reply begins with:

```text
Mortis Operator Status
```

Direct API smoke test from the server:

```bash
curl -fsS -X POST "http://127.0.0.1:8088/api/telegram/operator-message?workspace_slug=mortis" \
  -H "Content-Type: application/json" \
  -H "X-Mortis-Operator-Secret: $MORTIS_OPERATOR_EVENT_SECRET" \
  -d '{
    "message": {
      "message_id": 1,
      "text": "帮我修一下 README",
      "chat": {"id": "telegram-smoke", "type": "private"},
      "from": {"id": "operator", "first_name": "operator"}
    }
  }'
```

## Replication Checklist

1. Confirm backend has `MORTIS_OPERATOR_EVENT_SECRET` configured.
2. Confirm n8n is reachable at `https://mortis.tengokukk.com/n8n/`.
3. Create or update n8n Telegram credential with the bot token.
4. Create workflow `Mortis Telegram Operator`.
5. Add Telegram Trigger.
6. Normalize Telegram update into the Operator Event contract.
7. POST natural-language messages to Mortis `/api/telegram/operator-message?workspace_slug=mortis`.
8. Send `reply.text` back to the originating Telegram chat.
9. Activate workflow.
10. Send `帮我修一下 README` to the bot.
11. Verify the response says the message was routed to Builder and, when low-risk auto-approval is enabled, entered the Codex queue.

## Failure Modes

| Symptom | Check |
| --- | --- |
| Telegram receives nothing | n8n workflow active, Telegram webhook set to the active n8n URL, bot token valid |
| Bot does not react in group | BotFather privacy mode may hide normal group messages; test `/status@mortis_operator_bot`, reply to the bot, or disable privacy with BotFather `/setprivacy`. |
| n8n workflow succeeds but Telegram shows no reply | Current prototype uses webhook JSON response; switch to Telegram Trigger plus Telegram Send Message if response projection is not accepted. |
| n8n receives update but Mortis returns 401 | `MORTIS_OPERATOR_EVENT_SECRET` mismatch or missing secret header |
| Mortis returns 400 workspace required | URL must include `?workspace_slug=mortis` or send the expected workspace header/path used by the deployment |
| Mortis returns 400 text required | Normalize node did not map `message.text` into `text` |
| Bot replies unsupported command | Backend currently only supports `/status`, `status`, `/start` |
| Reply goes to wrong chat | Telegram Send Message chat id must use the original trigger chat id |

## Boundary Rules

- Telegram must not own command semantics.
- n8n must not become the Mortis source of truth.
- Token and gateway secret must stay outside Git.
- Command behavior should be implemented in Mortis Core first, then projected to Telegram.
- Telegram should display summaries, timelines, approval prompts, and artifact links; artifacts remain in Mortis.

## Next Backend Expansion

After the gateway is stable, add Mortis Core support for:

- `/runtime`
- `/artifacts`
- `/timeline`
- `/approve <id>`
- `/reject <id>`
- `/agents`

Do not implement these as n8n-only command branches. n8n should only normalize Telegram updates, call Mortis Core, and send the projection back.

## Runtime Configuration

Telegram reuses the same runtime split as QQ:

```text
chat / planning / research -> GLM-compatible runtime
code / test execution -> Codex-backed Builder / Tester runtime
```

Recommended backend env:

```text
MORTIS_TELEGRAM_AUTO_APPROVE_LOW_RISK=true
MORTIS_TELEGRAM_ALLOWED_USER_IDS=<your telegram user id>
MORTIS_TELEGRAM_ALLOWED_CHAT_IDS=<optional chat id allowlist>
```

## Deployment Note

The natural-language gateway writes `channel = telegram` into conversation and role tables. Deploy migration `060_add_telegram_role_channel` before sending real Telegram traffic to `/api/telegram/operator-message`.

On this host, running `go run ./cmd/migrate up` outside compose may fail if Postgres is only reachable from the Docker network. Run the migration through the backend/container deployment path in that case.
