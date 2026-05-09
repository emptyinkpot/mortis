# Matrix

## Repository

https://github.com/matrix-org/synapse

## Referenced Concepts

- event-first protocol architecture
- stable event identity
- room/conversation scoped event streams
- sender identity separated from transport
- channel-independent message content

## Referenced Areas In Mortis

- Unified Operator Event model
- channel gateway boundary for QQ, Telegram, Web, and future adapters
- timeline as append-only operational evidence
- conversation identity separate from runtime action identity

## NOT Copied

- Matrix federation
- state resolution algorithm
- room membership model
- Synapse implementation or protocol handlers

## Differences

Mortis uses Matrix as an event model reference, not as a federated chat protocol.

Mortis is:

- operator-runtime first
- workspace and artifact oriented
- approval and execution aware
- private deployment focused

Mortis is not:

- a federated messaging network
- a general-purpose chat server
- a Matrix homeserver replacement

## Why Matrix Matters

Matrix matters because Mortis should not treat QQ, Telegram, and Web as separate command systems. They should project into the same event universe. Matrix gives the architectural precedent for event identity, sender identity, room context, and channel-independent message content.
