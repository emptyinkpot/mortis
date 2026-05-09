# Operator Bus Topology

The Operator Bus is the topology that keeps Mortis from becoming a pile of channel-specific bots.

## Current Direction

```text
Telegram / Web / Scheduler / GitHub / legacy QQ
-> Channel Adapter
-> Unified Operator Event
-> Mortis Core
-> Dispatcher
-> Agent Runtime
-> Artifacts
-> Timeline / Evidence / Approval
-> Reply Projection
-> Telegram / Web / legacy QQ
```

## Layers

### Channels

Channels are ingress and egress surfaces.

Current and planned channels:

- Telegram / n8n webhook
- QQ / NapCat legacy adapter
- Web Cockpit
- Scheduler
- GitHub events
- future Discord or Matrix bridge

Channels should not own business semantics.

### Channel Adapters

Adapters translate external protocol details into Mortis events.

They preserve raw payloads but expose stable fields:

- channel
- conversation id
- actor id
- text
- attachments
- reply target
- raw event

### Unified Event Bus

The event bus is the logical boundary of Mortis Core.

Events should be appendable, replayable, and traceable to artifacts and replies.

Initial event types:

- `operator.command`
- `operator.status.requested`
- `operator.approval.requested`
- `operator.approval.granted`
- `runtime.action.created`
- `runtime.action.started`
- `runtime.action.completed`
- `artifact.created`
- `projection.sent`

### Mortis Core

Mortis Core owns command interpretation, task contracts, runtime routing, approval semantics, and artifact references.

### Dispatcher

Dispatcher translates task contracts into runtime work.

The current stable chain remains the first-class path:

```text
Dispatcher
-> Builder
-> Tester
-> Artifact
-> Report
```

### Agent Runtime

Agent runtime executes work inside controlled workspaces. It should produce deterministic evidence, not just natural language summaries.

### Artifact Runtime

Artifacts are durable outputs:

- commit
- diff
- logs
- test report
- verification report
- deployment report
- screenshots
- replay metadata

### Timeline Runtime

Timeline connects events, actions, artifacts, approvals, and projections into a single operational history.

### Reply Projection

Projection formats runtime state back to a channel.

Examples:

- Telegram short status message
- optional legacy QQ group notification
- Web timeline row
- Web artifact drawer

Projection is not the source of truth.

## n8n Position

n8n is currently a gateway and prototyping layer.

```text
Telegram
-> n8n webhook
-> Mortis API
-> Telegram webhook response
```

This is acceptable for validating channel behavior quickly. Stable command semantics should move into Mortis Core when proven.

## QQ Position

QQ/NapCat is a legacy and optional channel gateway. It should not be the central nervous system of Mortis.

QQ is useful for notifications and compatibility, but Mortis must remain functional when QQ accounts are offline.

## Telegram Position

Telegram is the primary mobile operator cockpit candidate.

It should support:

- status snapshots
- timeline summaries
- approval prompts
- artifact links
- runtime alerts

Telegram should not own state.

## Web Position

Web Cockpit remains the source-of-truth operator surface.

It should show:

- active actions
- timeline
- artifacts
- approvals
- runtime health
- channel delivery status
