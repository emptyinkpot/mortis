# n8n

## Repository

https://github.com/n8n-io/n8n

## Referenced Concepts

- webhook-first automation
- external service glue
- visual workflow authoring
- retryable automation steps
- low-code channel gateway experiments

## Direct Runtime Usage

Mortis currently runs n8n as an automation gateway for Telegram experiments.

Current production role:

```text
Telegram
-> n8n webhook
-> Mortis summary/API
-> Telegram webhook response
```

## Referenced Areas In Mortis

- Telegram Gateway MVP
- future automation gateway boundary
- workflow prototyping before native Mortis implementation
- external channel trigger experiments

## NOT Copied

- n8n workflow engine source
- node implementation code
- credential system
- editor UI

## Differences

Mortis uses n8n as a gateway and prototyping layer. Mortis Core remains the source of truth.

Mortis is:

- operator runtime first
- artifact and approval aware
- timeline and execution evidence oriented

Mortis is not:

- a low-code automation product
- a workflow marketplace
- a replacement for n8n

## Why n8n Matters

n8n matters because it lets Mortis validate channel gateway behavior quickly without hand-rolling a bot framework, queue, retry system, or workflow editor too early.
