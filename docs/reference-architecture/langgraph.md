# LangGraph

## Repository

https://github.com/langchain-ai/langgraph

## Referenced Concepts

- graph-based agent execution
- explicit state transitions
- durable workflow checkpoints
- conditional routing
- long-running agent state

## Referenced Areas In Mortis

- future Agent Runtime Graph
- dispatch state machine design
- approval-gated transitions
- replay and timeline semantics
- multi-step execution plans

## NOT Copied

- LangGraph runtime
- checkpoint storage implementation
- LangChain integration code
- graph DSL

## Differences

Mortis references LangGraph for execution graph thinking, but does not make LangGraph the core runtime today.

Mortis is:

- operator event and artifact first
- Go/SQL contract oriented
- channel gateway aware

Mortis is not:

- a LangChain application shell
- a generic DAG framework
- a visual workflow builder

## Why LangGraph Matters

LangGraph matters because Mortis needs explicit execution state rather than informal agent conversation. Commands should become state transitions, artifacts, approvals, and timeline events.
