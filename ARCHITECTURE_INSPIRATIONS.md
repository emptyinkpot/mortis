# Architecture Inspirations

Mortis is influenced by multiple systems across operator consoles, ChatOps, multi-channel conversation runtimes, agent execution, and durable workflow orchestration.

This repository documents conceptual inspirations, architectural references, interaction models, and implementation ideas explicitly so future contributors and AI agents do not need to guess what Mortis is trying to become.

This is not a direct clone of any single project.

## Reference Domains

### Operator Event Runtime

- Matrix: event-first protocol architecture and channel-independent message identity.
- Mattermost: ChatOps commands, plugin surfaces, and operator workflows inside conversation.
- Chatwoot: multi-channel conversation abstraction and unified inbox thinking.

### Agent Execution Runtime

- OpenHands: workspace lifecycle, sandboxed engineering agents, event streams, and execution evidence.
- LangGraph: durable graph execution and explicit state transitions for agent workflows.
- AutoGen: group-chat agent collaboration and turn-taking discipline.
- CrewAI: role-based agent crew boundaries.

### Automation Gateway

- n8n: webhook-first automation, retryable workflows, visual operators, and external channel glue.

## Direct Usage vs Conceptual Inspiration

A reference document may describe one of three relationships:

- Conceptual Inspiration: Mortis adopts a pattern or architectural idea.
- Direct Dependency: Mortis runs or imports the software as part of its runtime.
- Adapted Implementation: Mortis has copied or modified a specific implementation. This must name the source file and license.

Unless a file explicitly says otherwise, entries under `docs/reference-architecture/` are conceptual references, not copied source code.

## Reference Graph

```text
Mortis
|- Matrix (event identity, channel-independent event model)
|- Mattermost (ChatOps and slash-command operator workflows)
|- Chatwoot (multi-channel conversation runtime)
|- OpenHands (workspace execution and evidence stream)
|- LangGraph (durable execution graph concepts)
|- AutoGen (agent group chat and turn-taking)
|- CrewAI (role-based agent crews)
|- n8n (automation gateway and webhook workflow surface)
```

## AI Reading Rule

Before making architectural changes to channels, runtime execution, artifacts, approvals, or timeline behavior, read the relevant reference file in `docs/reference-architecture/` and the core architecture docs:

- `AI_CONTEXT.md`
- `docs/architecture/mortis-shell.md`
- `docs/architecture/stable-execution-chain.md`
- `docs/architecture/agent-os-core.md`
- `docs/philosophy/operator-event-runtime.md`
- `docs/topology/operator-bus.md`
- `docs/architecture/agent-society-runtime.md`
