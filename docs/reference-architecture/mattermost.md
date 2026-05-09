# Mattermost

## Repository

https://github.com/mattermost/mattermost

## Referenced Concepts

- ChatOps workflow surface
- slash commands
- plugin-driven operator extensions
- conversation-native automation
- human operator in the loop

## Referenced Areas In Mortis

- Telegram and QQ commands as mobile operator surfaces
- `/status`, `/approve`, `/run`, and future operator commands
- channel projections that report artifacts, approvals, and runtime state
- operator-first control surface rather than generic chatbot behavior

## NOT Copied

- Mattermost server implementation
- plugin runtime
- team/channel permission system
- React UI code

## Differences

Mortis uses ChatOps as an operator pattern, not as a team chat product.

Mortis is:

- single-operator and private-runtime oriented
- AI execution and artifact-first
- workspace and deployment aware

Mortis is not:

- a Slack or Mattermost clone
- a general team collaboration suite
- a plugin marketplace

## Why Mattermost Matters

Mattermost shows that chat can be a serious operations surface when commands, workflows, permissions, and automation are designed around operator intent. Mortis adopts this ChatOps idea while keeping Web Cockpit as the source of truth.
