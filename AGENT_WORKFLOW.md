# Agent Workflow

本文定义 Mortis 多 Agent 协作时必须遵守的仓库工作流。它的目标不是让 Agent 更会聊天，而是让多个 Agent 可以在同一个远程源码真相源上并行工作，同时避免抢 `main`、抢目录、覆盖彼此修改、提交运行时垃圾目录。

## Golden Rule

No agent may edit `main` directly.

Every agent must work on its own topic branch and its own worktree.

Mortis 的默认共同源码工作地是：

```text
ubuntu@124.220.233.126:/srv/multica
```

本机副本不是默认修改端。除非用户明确指定，本仓库的一切代码、文档、部署配置修改都应先发生在远端 `/srv/multica`，再验证、提交、推送。

## Roles

- `architect`: design, contracts, architecture docs
- `implementer`: code changes
- `reviewer`: review, tests, regression checks
- `researcher`: external references and alternatives
- `release-manager`: merge/deploy decision

## Branch Naming

Use:

- `agent/<agent-id>/<task-slug>`
- `fix/<agent-id>/<task-slug>`
- `docs/<agent-id>/<task-slug>`
- `refactor/<agent-id>/<task-slug>`

Examples:

```text
agent/claude-architect/a2a-mailbox-contract
fix/codex-implementer/telegram-event-gateway
docs/gemini-researcher/reference-architecture-map
```


## Coordination Runtime

Branch names are not the coordination truth. A branch cannot tell other agents what paths are claimed, whether the task is blocked, or who should receive the next handoff.

The coordination truth is `.runtime/`:

```text
.runtime/
├── claims/
├── timeline/
├── agents/
├── artifacts/
└── locks/
```

Before starting any task:

1. Read `.runtime/claims/`.
2. Read `.runtime/timeline/`.
3. Check for overlapping claimed paths.
4. If overlap exists, coordinate by delegation, handoff, or wait.
5. Create your own claim file.
6. Only then create or enter your branch/worktree and start editing.

Do not assume paths are free. Do not use branch names as the source of truth for coordination. Claim files are the coordination truth.

## Worktree Rule

Each agent must create or use a dedicated worktree:

```bash
git fetch origin
git checkout main
git pull --ff-only
git worktree add ../worktrees/<agent-id>-<task-slug> -b <branch-name> origin/main
cd ../worktrees/<agent-id>-<task-slug>
```

Never let two agents modify the same physical directory.

If a task is explicitly a short repository-policy/documentation update and the operator asks for direct remote execution, an agent may edit `/srv/multica` directly only when all of these are true:

- the edit is path-scoped and small
- dirty unrelated runtime files are not staged
- the final delivery still uses path-scoped staging
- the agent reports that it bypassed a dedicated worktree and why

This exception is for operator-directed maintenance only. It is not the default engineering flow.

## Claim Rule

Before editing, create a claim file:

```text
.runtime/claims/<task-id>.json
```

Claim status must be one of:

- `active`
- `blocked`
- `review`
- `handoff`
- `completed`
- `abandoned`


Example:

```json
{
  "task_id": "a2a-mailbox-contract",
  "title": "Implement A2A mailbox contract",
  "agent_id": "claude-architect",
  "role": "architect",
  "branch": "agent/claude-architect/a2a-mailbox-contract",
  "worktree": "../worktrees/claude-architect-a2a-mailbox-contract",
  "claimed_paths": [
    "docs/architecture/agent-society-runtime.md",
    "contracts/a2a-mailbox.schema.json"
  ],
  "status": "active",
  "created_at": "2026-05-09T10:00:00Z",
  "updated_at": "2026-05-09T10:12:00Z"
}
```

Claim files are coordination records. They do not replace Git history, PR review, or CI.

## Timeline Rule

Every important coordination transition should append a JSON Lines event to `.runtime/timeline/events.jsonl` or the active task timeline file.

Example:

```json
{
  "time": "2026-05-09T10:15:00Z",
  "agent": "claude-architect",
  "event": "claim.created",
  "task": "a2a-mailbox-contract",
  "paths": ["contracts/a2a-mailbox.schema.json"]
}
```

Timeline events let other agents see who started work, what changed, what is blocked, and where the next handoff goes.

## Lock Rule

Use `.runtime/locks/` when a path or external resource cannot be safely edited by more than one agent at a time. If a path is locked or claimed by another active task, do not edit it silently. Coordinate first.

## Path Ownership

Agents may only edit claimed paths.

If another agent needs the same path, they must negotiate through a delegation/timeline event, not silently overwrite.

Runtime state directories must not be committed:

- `agent-workspaces/`
- `openlist-export/`
- `codex-home/`
- `.runtime/claims/` unless the operator explicitly asks to persist a claim example

## Commit Rule

Use path-scoped staging only:

```bash
git status --short
git add <specific-file-1> <specific-file-2>
git diff --cached
git commit -m "<type>: <summary>"
```

Forbidden:

```bash
git add .
git commit -a
git push origin main
git push --force
```

Do not include unrelated dirty files in a commit. If unrelated files are already dirty, leave them alone and report them.

## Pull Request Rule

Every agent branch must end as one of:

- PR opened
- branch pushed for review
- local-only by explicit request
- blocked with reason

Default is PR.

Direct push to `main` is only allowed for repository-owner maintenance when the operator explicitly requests it and branch protection permits it. Normal multi-agent engineering work must go through PR.

## Verification Rule

Before push, run the relevant checks:

```bash
make policy-check
npm run check
npm run test
./scripts/check-repository-policy.sh
```

Use the checks that exist for the touched area. If checks cannot run, the agent must write why.

## GitHub Protection

The GitHub repository should protect `main` with:

- require pull request before merging
- require status checks
- disallow force pushes
- disallow direct pushes
- require review if possible

Required status checks should include the repository policy workflow and the relevant project checks.

## Delivery Report

Every agent must finish with:

```text
Delivery state:
Branch:
Commit:
PR:
Files changed:
Checks:
Known risks:
Next agent:
```
