# Security Policy

Mortis is currently a private operator deployment built on a Multica-compatible runtime foundation.

## Supported Scope

Security reports should focus on the current private deployment boundary and repository code that can affect:

- operator authentication and authorization
- role action approval and execution
- workspace isolation
- artifact integrity
- secrets handling
- channel gateway ingress, including QQ, Telegram, Web, n8n, and future adapters
- self-host Docker and backend deployment configuration

## Not Supported As Security Boundaries

The following are integration surfaces, not trusted security roots:

- QQ / NapCat login state
- Telegram bot availability
- n8n workflow state
- browser automation workers
- local synchronized checkouts

These can be useful gateways, but Mortis Core and `/srv/multica` remain the source of truth for runtime behavior.

## Reporting

For private deployment issues, contact the repository owner directly before opening a public issue.

Do not include tokens, cookies, bot secrets, `.env` values, database dumps, or private server logs in public GitHub issues.

## Current Source Boundary

The default working source root is:

```text
ubuntu@124.220.233.126:/srv/multica
```

Normal security fixes should follow:

```text
edit /srv/multica
-> validate remotely
-> commit in /srv/multica
-> push GitHub main
```

Local checkouts are synchronized copies only.
