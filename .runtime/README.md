# Runtime Coordination Registry

`.runtime/` is the lightweight coordination registry for Mortis agents.

It is not a source-code module and it is not a replacement for Git history. It is the place where agents discover who is already working, which paths are claimed, what handoffs happened, and which runtime locks exist.

## Directories

- `claims/`: task claims. Each active task should have one JSON claim file.
- `timeline/`: append-only coordination events, usually JSON Lines.
- `events/`: durable runtime event records, one JSON file per event when applicable.
- `mailboxes/`: per-agent mailbox queues for A2A delegation and responses.
- `agents/`: optional agent identity and capability records.
- `artifacts/`: references to produced artifacts, reports, patches, evidence, or external artifact storage.
- `locks/`: path or resource locks for high-conflict work.

## Before Any Agent Starts Work

1. Read `AGENT_WORKFLOW.md`.
2. Read `contracts/agent-collaboration-policy.json`.
3. Read `.runtime/claims/`.
4. Read `.runtime/timeline/`.
5. Read relevant `.runtime/mailboxes/` entries when handling A2A work.
6. Check for overlapping claimed paths.
7. Create or update a claim before editing.

Do not assume a path is free just because no branch name mentions it. Claim files are the coordination truth; branches are only Git projections.

## Tracked vs Runtime State

The directory skeleton and schemas are tracked. Live claim, timeline, event, mailbox, lock, agent, and artifact JSON records are runtime state unless the operator explicitly asks to persist an example.
