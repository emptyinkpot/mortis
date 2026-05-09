# Workspace Runtime

Mortis workspace runtime controls where agent work happens and how it can be replayed.

## Source Root

Default shared source root:

```text
ubuntu@124.220.233.126:/srv/multica
```

Local checkouts are synchronized copies only and must not become the default source of truth.

## Action Workspaces

Builder actions use isolated workspaces under:

```text
/srv/multica/agent-workspaces/action-<action_id>/repo
```

The production source tree may be mounted read-only into the backend container as `/source`, and Builder clones from `file:///source` into an action workspace.

## Runtime State Not Tracked In Git

Do not commit these runtime directories:

- `agent-workspaces/`
- `openlist-export/`
- `codex-home/`

## Workspace Goal

Each action should be replayable from:

- objective / prompt
- task contract
- workspace path
- changed files
- diff
- commit
- commands run
- logs
- verification result
- remaining risk

## Containerization Direction

The long-term direction is one task, one isolated workspace boundary. Containerized action execution should wrap the current contract instead of replacing it.

See `docs/architecture/stable-execution-chain.md` for the current rule.
