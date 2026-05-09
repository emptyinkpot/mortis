# Support

Mortis is operated as a private AI operations cockpit, not a public hosted service.

## Primary Operator Surface

Use the Web cockpit as the source of truth:

```text
https://mortis.tengokukk.com/mortis/agent-os
```

## Channel Gateways

Mortis may be reached through multiple channel projections:

- Web cockpit
- Telegram gateway through n8n
- QQ / NapCat gateway
- future scheduler, GitHub, Discord, or Matrix adapters

These channels are gateways. They do not own business semantics or runtime state.

If QQ or Telegram is unavailable, inspect Mortis Core and the Web cockpit first before debugging the channel provider.

## Runtime Facts

Current runtime and operations facts are documented in:

- `AI_CONTEXT.md`
- `docs/operations/current-runtime-map.md`
- `docs/topology/operator-bus.md`
- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`

## Source Of Truth

Default source work happens on the remote host:

```text
ubuntu@124.220.233.126:/srv/multica
```

Local checkouts are temporary synchronized copies only.
