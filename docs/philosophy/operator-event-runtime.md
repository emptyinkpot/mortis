# Operator Event Runtime

Mortis is an operator event runtime.

The project should not be understood as a QQ bot, Telegram bot, chatbot, task board, or AI IDE. Those are surfaces. Mortis Core is the runtime that receives operator intent, turns it into events, dispatches work, records artifacts, and projects results back to the operator.

## Thesis

```text
Channels are projections.
Events are the runtime boundary.
Artifacts are the proof.
Timeline is the memory of operations.
Approvals are explicit state transitions.
```

## Why This Exists

Mortis started with concrete channel integrations and AI collaboration workflows. The risk is that every channel grows its own command logic and operational state. That creates drift.

The operator event runtime exists to prevent that drift:

- Telegram should not own `/status` semantics.
- QQ should not own Builder or Tester semantics.
- Web should not own approval semantics.
- n8n should not own source-of-truth state.

All channels should emit normalized events into Mortis Core.

## Unified Operator Event

A normalized event should preserve raw channel evidence while exposing a stable operator-facing shape.

```json
{
  "event_type": "operator.command",
  "workspace": "mortis",
  "channel": "telegram",
  "conversation": {
    "id": "123456",
    "type": "private"
  },
  "actor": {
    "external_id": "123456",
    "display_name": "operator"
  },
  "text": "/status",
  "raw": {}
}
```

## Artifact-first Rule

A runtime step is not complete because an agent says it is complete.

It is complete when it creates the required artifact:

- commit artifact
- diff artifact
- test report
- verification report
- deployment report
- screenshot or browser evidence
- approval object

Channel replies should summarize artifacts. They should not replace artifacts.

## Timeline-first Rule

A system operator should be able to ask where a task is stuck.

That requires timeline events for:

- event received
- command parsed
- task contract created
- runtime selected
- workspace prepared
- builder started
- builder completed
- tester started
- tester completed
- artifact created
- approval requested
- reply projected

## Approval Rule

Approvals must target objects, not vague text.

```json
{
  "approval_target_type": "artifact",
  "approval_target_id": "...",
  "risk_level": "high",
  "target_environment": "production",
  "requested_by_event_id": "..."
}
```

## Difference From Bot Commands

Bot commands are a surface detail. Operator events are the architectural contract.

```text
/status
```

is only a channel expression of:

```json
{
  "event_type": "operator.status.requested"
}
```

## Design Consequence

When adding a new command, implement it in Mortis Core first, then project it to QQ, Telegram, Web, or n8n. Do not implement the same command separately in each adapter.
