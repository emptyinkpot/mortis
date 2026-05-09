# Chatwoot

## Repository

https://github.com/chatwoot/chatwoot

## Referenced Concepts

- multi-channel conversation abstraction
- unified inbox model
- contact/channel separation
- conversation assignment and state
- message projection across heterogeneous channels

## Referenced Areas In Mortis

- QQ, Telegram, Web, and future channels as adapters
- normalized operator events independent of source protocol
- channel projection boundary for replies and notifications
- conversation runtime separate from agent runtime

## NOT Copied

- Chatwoot Rails backend
- inbox UI implementation
- customer support workflows
- channel connector code

## Differences

Mortis references Chatwoot for channel abstraction, not customer support.

Mortis is:

- operator-command oriented
- artifact and approval aware
- AI runtime focused

Mortis is not:

- a helpdesk
- a customer conversation CRM
- a sales/support inbox

## Why Chatwoot Matters

Chatwoot matters because Mortis has the same class of channel problem: Telegram, QQ, and Web should not create separate business logic. They should become channel adapters into one conversation and operator event runtime.
