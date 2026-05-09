# A2A Messaging Layer

Mortis does not currently have true Agent-to-Agent runtime. This document defines the minimum messaging layer required to move from orchestrated multi-agent execution into real A2A collaboration.

## Current Non-A2A Shape

Current managed-agent execution is operator or core orchestrated:

```text
Operator
-> Mortis Core
-> Agent A
-> result
```

or:

```text
Mortis Core
-> Architect
-> Implementer
-> Reviewer
```

This is useful and should remain the stable base, but it is not A2A. The missing capability is agent-initiated delegation and artifact exchange.

## A2A Goal

A2A begins when an agent can:

- address another agent by identity
- create a delegation request
- attach or reference artifacts
- route the request through Mortis Core
- receive the response in a mailbox
- update the shared timeline
- preserve operator visibility and approval boundaries

## Required Primitives

### Agent Registry

A registry gives every long-running role a stable address.

```json
{
  "agent_id": "claude-architect",
  "role": "architect",
  "display_name": "Claude Architect",
  "status": "active",
  "allowed_outbound_events": ["agent.delegation.requested"],
  "allowed_targets": ["codex-implementer", "reviewer", "researcher"]
}
```

### Agent Addressing

Agents must not route by display text or Telegram username. They route by stable `agent_id`.

Examples:

- `claude-architect`
- `codex-implementer`
- `reviewer`
- `tester`
- `gemini-researcher`

### Agent Mailbox

Each agent needs an inbox for routed A2A events.

```text
mailbox://claude-architect/task-123
mailbox://codex-implementer/task-123
mailbox://reviewer/task-123
```

A mailbox is not a chat room. It is a structured queue of events addressed to a role agent.

### Delegation Event

Minimal request:

```json
{
  "event_type": "agent.delegation.requested",
  "event_id": "evt_...",
  "workspace_slug": "mortis",
  "task_contract_id": "task_123",
  "from_agent_id": "claude-architect",
  "to_agent_id": "codex-implementer",
  "intent": "implement",
  "summary": "Implement drawer projection changes from the attached architecture plan.",
  "artifact_refs": ["artifact://task_123/architecture.md"],
  "required_artifacts": ["patch.diff", "test_report"],
  "reply_to": "mailbox://claude-architect/task-123",
  "operator_visible": true
}
```

Minimal response:

```json
{
  "event_type": "agent.delegation.completed",
  "event_id": "evt_...",
  "workspace_slug": "mortis",
  "task_contract_id": "task_123",
  "from_agent_id": "codex-implementer",
  "to_agent_id": "claude-architect",
  "in_reply_to": "evt_...",
  "artifact_refs": [
    "artifact://task_123/patch.diff",
    "artifact://task_123/test_report.md"
  ],
  "status": "completed"
}
```

### Artifact Store

A2A messages should pass artifact references, not large blobs.

Required artifact classes:

- plan
- delegation contract
- patch
- diff
- test report
- review report
- verification evidence
- screenshot
- deployment evidence

### Timeline Projection

Every A2A event should project into timeline entries.

```text
13:02 Architect delegated drawer projection to Implementer
13:04 Implementer produced patch.diff and test_report.md
13:05 Reviewer requested regression verification
13:07 Tester produced verification_report.md
```

Telegram and Web consume this projection. They do not own the A2A state.

## Permission Rules

A2A must not mean every agent can call every other agent.

Initial rules:

- Architect may delegate to Implementer, Reviewer, Researcher, and Tester.
- Implementer may request review or test verification.
- Reviewer may request fixes from Implementer or verification from Tester.
- Researcher may return research artifacts but must not request deploy.
- Tester may return verification artifacts but must not approve production changes.
- Only Operator or an explicitly approved runtime policy may authorize deployment.

## MVP Flow

```text
Operator creates task
-> Architect creates plan artifact
-> Architect sends delegation event to Implementer
-> Implementer creates patch and test report artifacts
-> Implementer replies to Architect mailbox
-> Architect sends review request to Reviewer
-> Reviewer returns review artifact
-> Tester verifies exact artifact
-> Timeline projects all events
-> Operator approves or rejects
```

## Non-Goals

Do not start with:

- free-form agent group chat
- five or more autonomous agents
- long-term memory as the first feature
- Telegram as the source of truth
- direct agent-to-provider calls that bypass Mortis Core

## Success Standard

The first A2A milestone is successful only when this can be shown:

```text
An agent, not the operator, delegated work to another agent.
The request used stable agent IDs.
The response returned artifact references.
The event appeared in the timeline.
The operator could inspect and approve the chain.
```
