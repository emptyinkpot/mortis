# Mortis NapCat Control

This app is the minimal shared source for three linked jobs:

- let Mortis / multica trigger a constrained NapCat send path
- expose NapCat WebUI behind a proper HTTPS domain and reverse proxy
- publish a sanitized public code snapshot for later customization

The current production target is the NapCat deployment on `124.220.233.126`.

## Layout

- `backend/send-mortis-group.ps1`
  - local wrapper for Mortis / Codex runtime on NEVERLETMEGO
- `backend/remote/send_napcat_group.py`
  - remote helper that reuses the host `notify.py` auth/logging functions while rendering its own fixed-prefix message body
- `backend/host-control/`
  - sanitized snapshot of the live host control files (`notify.py`, env example, operator README)
- `backend/napcat/docker-compose.yml`
  - the current NapCat container shape used on `124`
- `backend/nginx/napcat.tengokukk.com.conf`
  - nginx template for the HTTPS reverse proxy
- `backend/nginx/napcat.tengokukk.com.live.conf`
  - the live nginx config after certbot deployment
- `docs/MORTIS_AGENT_SETUP.md`
  - exact agent / issue wiring notes
- `docs/DEPLOY.md`
  - deploy and verification flow

## Safety Model

- keep the public repo sanitized
- keep real NapCat WebUI token, ssh keys, and live account credentials off-repo
- keep the Mortis-triggerable send path limited to approved group targets
- keep the wrapper interface constrained to:
  - fixed group `689863409`
  - whitelisted template keys: `notify`, `status`, `alert`
  - whitelisted source tags: `mortis-ai`, `mortis-watch`, `mortis-ops`
  - fixed visible prefixes generated on the remote helper, not supplied by callers

## Message Contract

- wrapper entrypoint:
  - `backend/send-mortis-group.ps1 -Body <text> -TemplateKey <notify|status|alert> -SourceTag <mortis-ai|mortis-watch|mortis-ops>`
- rendered outbound message shape:

```text
[Mortis AI][通知]
来源标识：mortis-ai
<body>
```

- callers can only control the body text plus the whitelisted template/source selectors
- callers cannot override the group id or inject an arbitrary message prefix

## Current Verified State

- default host notify target is now group `689863409`
- live HTTPS WebUI route is `https://napcat.tengokukk.com/webui/network`
- Mortis now has a dedicated workspace agent name reserved for this path:
  - `NapCat Group Operator`
