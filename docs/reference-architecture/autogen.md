# AutoGen

## Repository

https://github.com/microsoft/autogen

## Referenced Concepts

- multi-agent group conversation
- turn-taking and speaker selection
- agent-to-agent delegation
- role-specific agents in a shared conversation
- task-oriented group chat loops

## Referenced Areas In Mortis

- future Agent Society Runtime
- Telegram group projection for multiple long-running agent identities
- delegation events between Architect, Implementer, Reviewer, Researcher, and Tester
- turn discipline to prevent uncontrolled agent chatter

## NOT Copied

- AutoGen runtime implementation
- GroupChat source code
- agent framework internals
- model adapter code

## Differences

Mortis references AutoGen for group collaboration patterns, not as the source of truth runtime.

Mortis is:

- operator-controlled
- artifact-first
- workspace and worktree aware
- timeline and approval oriented

Mortis is not:

- a free-running multi-agent chat demo
- a generic AutoGen application shell
- an unrestricted autonomous group chat

## Why AutoGen Matters

AutoGen matters because Mortis needs a disciplined model for agents speaking to each other, delegating work, and taking turns. The lesson is not "let agents talk forever". The lesson is to structure agent society around roles, turn order, and task termination.
