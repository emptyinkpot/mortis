# CrewAI

## Repository

https://github.com/crewAIInc/crewAI

## Referenced Concepts

- role-based agent crews
- explicit task ownership
- collaborative execution roles
- process control for multi-agent work
- separation between agent identity and task assignment

## Referenced Areas In Mortis

- Architect / Implementer / Reviewer / Researcher / Tester role boundaries
- Agent Society MVP scoping
- delegation contracts
- role-specific artifact requirements

## NOT Copied

- CrewAI runtime implementation
- task execution engine
- agent APIs
- tool integration code

## Differences

Mortis references CrewAI for role framing. Mortis does not adopt CrewAI as the runtime source of truth today.

Mortis is:

- event-bus driven
- artifact and timeline first
- channel projection aware
- shared workspace/worktree oriented

Mortis is not:

- a generic crew execution framework
- a role-prompt library
- a multi-agent demo runner

## Why CrewAI Matters

CrewAI matters because it shows that multi-agent systems need explicit role ownership. Mortis should not make every agent interchangeable. Architect, Implementer, Reviewer, Researcher, and Tester must have different responsibilities and different artifact contracts.
