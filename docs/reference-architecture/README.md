# Reference Architecture Map

This directory records the systems that influence Mortis architecture.

The purpose is not acknowledgement boilerplate. The purpose is to make the project worldview explicit:

- what was referenced
- which concepts matter
- where those concepts appear in Mortis
- what was not copied
- how Mortis differs

## Current Reference Set

- `matrix.md`: event-first protocol model and channel-independent operator events
- `mattermost.md`: ChatOps, slash commands, and operator workflows
- `chatwoot.md`: multi-channel conversation runtime and unified inbox abstraction
- `openhands.md`: engineering agent workspace lifecycle and execution evidence
- `langgraph.md`: durable execution graph and state transitions
- `autogen.md`: group-chat agent collaboration and turn-taking patterns
- `crewai.md`: role-based agent crew boundaries
- `n8n.md`: automation gateway and webhook workflow surface
- `astrbot.md`: multi-platform chatbot shell, WebUI, plugin ecosystem, knowledge base, and group-chat behavior

## Boundary

These documents describe conceptual and architectural references unless a section explicitly states direct code usage. Do not infer copied implementation from conceptual influence.
