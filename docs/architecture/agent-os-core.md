---
title: Mortis Agent OS Core
status: draft-canonical
audience: mortis operators and implementers
scope: architecture consolidation plan
---

# Mortis Agent OS Core

> Superseded product boundary: `docs/architecture/mortis-shell.md` is the higher-level product direction. This document remains an implementation map for existing Agent OS primitives, not permission to expand AI society/runtime layers before the operator shell is stable.


Mortis is no longer just an AI chat surface or an issue tracker with agents. The
current target is:

```text
AI Operations Cockpit / Mortis Shell
```

The implementation should consolidate around this operating model:

```text
Single Operator
-> Workspace
-> Role Router
-> Operator Shell
-> Execution Graph
-> Artifact System
-> Memory and Knowledge
-> Runtime Infrastructure
```

This document is the implementation bridge between the existing Multica-derived
task/runtime system and the newer Mortis Role AI / Studio OS tables.

## Current Assets

Mortis already has the core pieces. The problem is not absence of primitives;
the problem is that they are not yet presented or enforced as one primary
execution path.

### Legacy Execution Layer

These tables and services are the proven task execution layer:

- `agent`
- `agent_runtime`
- `agent_task_queue`
- `task_message`
- `task_usage`
- daemon registration, heartbeat, ping, update, and task claim APIs
- `packages/views/agents`
- `packages/views/runtimes`

This layer answers: which agent exists, which runtime can execute, and what task
is currently queued or running.

### Role OS Layer

These tables and handlers define the newer role-based organization system:

- `roles`
- `role_permissions`
- `role_channels`
- `role_runtime_bindings`
- `conversation_threads`
- `conversation_messages`
- `role_invocations`
- `role_actions`
- `approval_requests`
- `audit_events`
- `server/internal/handler/roles.go`
- `server/internal/roles`
- `packages/views/roles`
- `packages/views/manager`

This layer answers: who should receive intent, what action contract was created,
what needs approval, and which role owns the next move.

### Brain, Memory, and Knowledge Layer

These tables are the long-term continuity substrate:

- `agent_brain_states`
- `agent_memories`
- `agent_relationships`
- `agent_emotions`
- `agent_goals`
- `agent_journals`
- `agent_transcripts`
- `agent_knowledge_items`
- `agent_memory_items`
- `agent_social_observations`
- `agent_learning_jobs`
- `agent_feed_items`
- `agent_saved_items`
- `agent_life_events`

This layer answers: what the agent knows, remembers, prefers, has observed, and
has learned over time.

### Collaboration and Studio Layer

These tables are the Agent OS coordination layer:

- `agent_shared_threads`
- `agent_cognitive_events`
- `studio_resources`
- `studio_artifacts`
- `studio_state`

This layer answers: what agent discussion is in progress, what resources exist,
what artifact proves completion, and what system gap is still open.

## Current Main Path

The current executable path is:

```text
operator message
-> /api/roles/route-message
-> conversation_threads / conversation_messages
-> role_invocations
-> role_actions
-> approval when required
-> dispatcher claims approved role_actions
-> builder-local-codex or tester-local-verifier
-> execution_report in role_invocations.result
-> studio_artifacts where supported
-> QQ/Web/operator summary
```

This path is directionally correct. The next work is to make it explicit,
observable, and artifact-first everywhere.

## Core Rule

Issue is not the center of Mortis.

The center is:

```text
Workspace state + runtime topology + durable artifacts + long-term agent memory
```

Issues remain useful work surfaces, but they should not be the only source of
truth for agent work, handoff, verification, or memory.

## Target Concepts

### Agent Constitution

Each long-lived agent needs an explicit constitution. It can initially be backed
by existing DB fields and later be mirrored to files.

Minimum shape:

```text
agent identity
role binding
responsibilities
forbidden actions
runtime binding
skills
memory summary
working preferences
operating contract
handoff contract
```

Current backing sources:

- `agent`
- `roles`
- `role_runtime_bindings`
- `agent_skill`
- `agent_brain_states`
- `agent_memories`
- `agent_goals`

Gap: there is no single API or UI that renders this as one constitution.

### Execution Graph

`role_actions` are currently a queue of approved work items. They need graph
semantics.

Minimum addition:

```text
parent_action_id
depends_on action ids
phase
handoff_to_role
artifact_policy
blocked_reason
resume_command
```

Target graph:

```text
Task / Goal
-> research
-> plan
-> implementation
-> verification
-> review
-> deployment note
```

Do not migrate to a graph runtime before this schema contract exists. LangGraph
or another DAG engine can be an adapter later.

### Artifact System

`studio_artifacts` is the canonical artifact table.

Accepted artifact types:

- `diff`
- `commit`
- `test_report`
- `verification_report`
- `bug_report`
- `design_note`
- `architecture_decision`
- `research_card`
- `benchmark`
- `deployment_note`
- `blocked_report`

Every claim of completion must cite at least one of:

- `role_action_id`
- `invocation_id`
- `studio_artifacts.id`
- command evidence
- CI/log evidence
- explicit blocked reason

Gap: artifacts are not yet first-class in the web UI or API client.

### Memory and Knowledge

Mortis should not keep expanding prompt memory as the primary memory mechanism.
The SQL memory tables are the local canonical substrate; Letta/MemGPT-style
memory blocks can be adopted behind an adapter.

Minimum memory blocks:

- identity memory
- project memory
- episodic memory
- semantic knowledge
- social memory
- skill memory

Retrieval rule:

```text
Before a role speaks or acts, retrieve relevant memory and knowledge by
workspace, role, subject, salience, recency, and source credibility.
```

Writeback rule:

```text
After a meaningful action, artifact, failed attempt, verification, or external
research card, write a durable memory or knowledge item.
```

Gap: memory retrieval and writeback are not yet part of the main role action
runtime path.

### Runtime Topology

Mortis needs a topology view, not only lists.

Minimum topology:

```text
Operator
-> Workspace
-> Roles
-> Agents
-> Runtimes
-> Actions
-> Artifacts
-> Resources
```

Current pages are separate:

- Agents page
- Runtimes page
- Roles page
- Manager page
- Control Plane page

Gap: there is no Agent OS overview that joins them.

### Inter-Agent Protocol

Agent collaboration should not be modeled as public chat. The durable protocol
is:

```text
from_role
to_role
intent
goal
context
constraints
expected_artifact
verification_method
handoff_target
failure_mode
```

Current backing sources:

- `agent_shared_threads`
- `agent_cognitive_events`
- `role_actions.payload`
- `studio_artifacts`

Gap: cognitive events are not yet a general handoff bus for all roles and
runtimes.

### Observability

Mortis must expose what each agent and runtime is doing.

Minimum observability fields:

```text
status
current action
current phase
runtime
workspace dir
branch
commit
last tool/command
last artifact
token usage
retry count
blocked reason
next action
```

Current backing sources:

- `agent_runtime`
- `agent_task_queue`
- `task_message`
- `task_usage`
- `runtime_usage`
- `role_invocations.result`
- `studio_state`
- `studio_artifacts`

Gap: role/action execution status and legacy runtime status are not unified in
one view.

## First Implementation Slice

The first slice should consolidate existing systems without replacing the
current dispatcher.

### Backend

1. Add read APIs for `studio_artifacts`.
2. Add read APIs for `studio_state`.
3. Add an Agent OS summary endpoint that joins:
   - roles
   - agents
   - runtimes
   - recent role actions
   - recent invocations
   - recent artifacts
   - partial/missing studio state
4. Ensure builder and tester execution reports always create or update
   `studio_artifacts`.
5. Add action graph fields to `role_actions` after the summary endpoint is
   stable.

### Frontend

1. Add `/:workspaceSlug/agent-os` or extend Manager into an Agent OS cockpit.
2. Show runtime topology:
   - roles
   - agents
   - runtimes
   - active actions
   - latest artifacts
   - blocked studio state
3. Add artifact list and detail panel.
4. Link each artifact back to action, invocation, role, runtime, and workspace.

### Runtime

1. Keep `builder-local-codex` as the proven implementation worker.
2. Keep `tester-local-verifier` as the proven verification worker.
3. Evaluate OpenHands only as an adapter that consumes approved `role_actions`
   and emits the same `execution_report` and `studio_artifacts` format.
4. Do not replace the current Go dispatcher until action graph semantics are
   stable.

## Non-Goals For This Phase

- Do not make QQ or NapCat required for Agent OS Core.
- Do not rewrite the backend around LangGraph yet.
- Do not turn agent collaboration into public group chat.
- Do not grant production write access to role personas.
- Do not make `issue` the only execution source of truth.
- Do not add more persona prompt rules instead of durable memory and artifact
  contracts.

## Acceptance Criteria

Agent OS Core first slice is acceptable when:

1. Operator can open one page and see roles, agents, runtimes, active actions,
   recent artifacts, and blocked studio state.
2. Builder completion creates commit and test report artifacts.
3. Tester completion creates verification report artifacts linked to Builder
   source action or invocation.
4. Every action summary can cite a real artifact, command output, CI/log status,
   or blocked reason.
5. The UI can answer: who is doing what, on which runtime, against which repo,
   with what artifact evidence.
6. No QQ/NapCat component is required for the web/backend Agent OS path.

## Recommended Next Task

Implement:

```text
GET /api/agent-os/summary
```

Back it with a small DTO, not a new framework. It should read existing tables
and expose a stable shape for the first Agent OS cockpit.
