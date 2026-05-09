# Agent Society Runtime

Mortis should not confuse managed agents with collaborative engineering agents.

Managed agents can accept assigned work and report status. Agent Society Runtime is different: it gives long-running role agents shared context, shared artifacts, shared workspace topology, turn discipline, and a common timeline.


## Current Stage

Mortis is currently at the Managed Agents Runtime stage.

Already present or partially present:

- Issue / task lifecycle
- Agent assignment and execution
- Runtime abstraction over external coding and AI runtimes
- Workspace isolation foundations
- Skills as reusable execution knowledge
- Operator surfaces through Web, Telegram, n8n, and legacy QQ gateways
- Status and monitoring projections

This means Mortis can already express:

```text
Operator
-> assigned agent
-> execution
-> result / report
```

The next stage is Collaborative Engineering Runtime:

```text
Operator
-> Agent Society
-> Shared Workspace
-> Shared Artifacts
-> Timeline
-> Delegation Graph
-> Engineering Runtime
```

The gap is not more bots. The gap is shared engineering context.

## Stage Boundary

Managed Agents are enough for single-agent execution. They are not enough for multi-agent engineering.

The boundary is crossed only when agents share:

- a coordination record
- role-specific workspace or worktree state
- artifact references
- timeline events
- delegation edges
- verification evidence

Telegram group identities are useful only after this boundary exists. Before that, multiple bots are only multiple message emitters.

## Thesis

```text
Telegram Group is a projection.
Mortis Core is the runtime.
Agent Society is the collaboration model.
Artifacts and worktrees are the proof.
```


## A2A Boundary

Mortis does not yet have true Agent-to-Agent runtime.

Current capability is closer to orchestrated multi-agent execution:

```text
Operator
-> Mortis Core
-> Agent A
-> result
```

or:

```text
Mortis Core
-> Claude
-> Codex
-> Reviewer
```

This is useful, but it is not autonomous A2A. True A2A begins when an agent can address another agent, request work, exchange artifacts, and produce timeline events without the operator manually sequencing every step.

A2A requires these runtime primitives:

- agent identity
- agent addressing
- agent mailbox
- delegation event routing
- shared artifact references
- role permission rules
- timeline projection

Minimal A2A event shape:

```json
{
  "event_type": "agent.delegation.requested",
  "from_agent_id": "claude-architect",
  "to_agent_id": "codex-implementer",
  "task_contract_id": "...",
  "artifact_refs": ["architecture.md"],
  "required_artifacts": ["patch.diff", "test_report"],
  "reply_to": "mailbox://claude-architect/task-123"
}
```

A2A is not proved by having multiple bots in Telegram. It is proved by an agent-initiated delegation that creates a routed event, produces an artifact, updates the shared timeline, and returns to the requesting agent or reviewer.

## Target Shape

```text
Telegram Group
-> Mortis Telegram Gateway
-> Unified Operator Event
-> Mortis Core
-> Agent Society Runtime
   |- Architect
   |- Implementer
   |- Reviewer
   |- Researcher
   `- Tester
-> Shared Workspace Runtime
-> Git Worktrees
-> Artifacts
-> Timeline / Evidence / Approval
-> Channel Projection
```

## What This Is Not

This is not five bots talking freely in a room.

This is not a shell bot with `/run` commands.

This is not a replacement for the stable Dispatcher -> Builder -> Tester chain.

This is not AutoGen or CrewAI dropped in as the whole system.

## Telegram Position

Telegram is a mobile operator surface and group-room projection.

It may show multiple agent identities:

- Architect Bot
- Implementer Bot
- Reviewer Bot
- Researcher Bot
- Tester Bot

But these identities are projections of Mortis agents. Telegram must not own task state, memory, or execution authority.

## Role Model

### Architect

Owns:

- architecture plan
- contracts
- risk analysis
- refactor boundaries
- delegation proposal

Does not own:

- direct production deploy
- unreviewed bulk edits

### Implementer

Owns:

- code edits
- mechanical refactors
- patch creation
- test execution in assigned worktree

Does not own:

- final acceptance
- high-risk architecture decisions

### Reviewer

Owns:

- diff review
- regression detection
- verification report
- blocker escalation

Does not own:

- silent code rewrites without an assigned review action

### Researcher

Owns:

- external research
- dependency investigation
- API and ecosystem comparison
- source-backed recommendations

Does not own:

- implementation commits

### Tester

Owns:

- build/test verification
- runtime smoke tests
- deployment evidence
- reproducible failure reports

Does not own:

- architecture decisions

## Turn System

The first MVP must use a disciplined turn system.

```text
Operator
-> Architect plan
-> Implementer patch
-> Reviewer review
-> Tester verification
-> Operator approval
```

No free-for-all agent conversation.

Agents may mention or delegate to another agent only by creating a structured event:

```json
{
  "event_type": "agent.delegation.requested",
  "from_role": "architect",
  "to_role": "implementer",
  "task_contract_id": "...",
  "required_artifacts": ["diff", "test_report"]
}
```

## Shared Workspace Runtime

The correct workspace unit is not an ad-hoc clone per agent.

The target model is git worktree based:

```text
/srv/multica/worktrees/
  task-123-architect/
  task-123-implementer/
  task-123-reviewer/
```

Rules:

- one task has one coordination record
- each role gets an isolated worktree
- artifacts reference commit/diff/worktree paths
- reviewer compares implementer output against base
- tester verifies the exact artifact, not a summary

## Artifact-first Collaboration

Agent messages are not enough.

Every important contribution must produce or reference an artifact:

- architecture plan
- delegation contract
- patch
- diff
- test report
- verification report
- screenshot
- deployment evidence
- review finding

Telegram should display artifact summaries and links, not become the artifact store.

## Memory Model

Agent Society requires multiple memory scopes:

- project memory: architecture, topology, decisions
- workspace memory: repo-specific facts and known pitfalls
- task memory: current plan, artifacts, blockers
- agent memory: role style, skill boundaries, prior performance

Do not add memory before event, artifact, and timeline contracts are stable.

## Reference Systems

Mortis should study:

- AutoGen GroupChat for multi-agent conversation and turn-taking patterns
- CrewAI for role-based collaboration framing
- OpenHands for engineering execution, workspace, and evidence flow
- LangGraph for durable execution graph and checkpoint thinking
- Matrix for event identity and conversation projection

## MVP Scope

P1 Agent Society MVP should include only:

- Architect
- Implementer
- Reviewer
- a single task thread
- one shared task record
- role-specific worktrees
- artifact references
- timeline projection
- Telegram group projection

Do not start with five or more agents.

Do not start with autonomous free conversation.

Do not start with long-term memory as the core feature.

## Success Standard

A successful MVP can show:

```text
Operator requested a code change.
Architect created a plan artifact.
Implementer created a diff artifact in a worktree.
Reviewer created a review artifact.
Tester or backend verification produced a test artifact.
Telegram showed the timeline.
Web Cockpit retained the source of truth.
```
