# NapCat Control Integration

The `integrations/napcat-control/` directory contains the migrated durable source
from `emptyinkpot/mortis-napcat-control`.

## Source Role

This is an integration adapter for Mortis. It is not the main Mortis app source.

The adapter provides:

- constrained NapCat group-send wrapper
- sanitized host-control templates
- nginx and docker-compose templates for the NapCat WebUI route
- Mortis agent wiring notes

## Source Repository Consolidation

Original source repository:

```text
https://github.com/emptyinkpot/mortis-napcat-control
```

Consolidation target:

```text
https://github.com/emptyinkpot/mortis-multica-source
path: integrations/napcat-control/
```

## Safety Rules

- Do not commit live NapCat tokens, cookies, SSH keys, or account credentials.
- Keep group-send paths constrained to approved group and template/source values.
- Keep host-specific deployment values in the server secret/config surface.
- Treat this integration as an adapter that Mortis can call, not as a generic
  chat-control capability.

## Current Entry Points

```text
integrations/napcat-control/backend/send-mortis-group.ps1
integrations/napcat-control/backend/remote/send_napcat_group.py
integrations/napcat-control/docs/DEPLOY.md
integrations/napcat-control/docs/MORTIS_AGENT_SETUP.md
```
