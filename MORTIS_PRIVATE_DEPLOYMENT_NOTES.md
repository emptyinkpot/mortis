---
title: Mortis private deployment notes
status: canonical-supporting
audience: mortis private operators
scope: current private deployment facts
---

# Mortis private deployment notes

This deployment uses the upstream Multica codebase as the runtime foundation,
but exposes a private single-operator workspace under the Mortis brand.

## Role In The Doc Stack

- `README.md` defines the current project-level truth and control-plane summary
- `project.json` is the machine-readable project entry
- `SELF_HOSTING.md` explains the generic self-host path supported by the repo
- this file records the current Mortis private deployment facts and operator shortcuts

This file is the canonical supporting note for the current private deployment.
It should stay factual, concise, and current-state-first.

## Current public entry

- Primary app URL: `https://mortis.tengokukk.com`
- Legacy redirect host: `https://golutra.tengokukk.com`
- Runtime directory: `/srv/multica`
- Local backend bind: `127.0.0.1:8088`
- Local frontend bind: `127.0.0.1:3300`

## Entrypoint classification

### Canonical

- `https://mortis.tengokukk.com`
- `/srv/multica`
- `docker compose -f docker-compose.selfhost.yml up -d --build`
- `make deploy-daemon-binary`

### Compatibility

- `multica` CLI naming
- `@multica/*` package names
- existing import paths and cookie names

### Legacy

- `https://golutra.tengokukk.com` as a direct operator target
- any assumption that generic self-host defaults `3000/8080` equal the current private deployment ports

## Current operator model

- The deployment is configured for direct single-user entry rather than a
  shared public login flow.
- The fixed operator identity is `emptyinkpot <emptyinkpot@users.noreply.github.com>`.
- The fixed default workspace is `Mortis` with slug `mortis`.
- Public routing, canonical URLs, and landing-page branding should all point to
  `mortis.tengokukk.com`.

## What has already been intentionally changed

- Public hostname and canonical URLs now point to `mortis.tengokukk.com`.
- The old `golutra.tengokukk.com` host is retained only as a redirect layer.
- The visible landing/login/about/workspace branding has been changed from
  Multica to Mortis where needed for the private deployment.

## What has intentionally NOT been globally renamed

- CLI command names such as `multica ...`
- pnpm workspace package names such as `@multica/*`
- Go import paths such as `github.com/multica-ai/multica/...`
- Cookie names such as `multica_auth` and `multica_csrf`
- Compose / database / internal runtime identifiers that still use `multica`

These remaining identifiers are treated as compatibility / fork-migration debt,
not as routine branding text. If they are changed later, do it as a dedicated
migration project rather than as part of ordinary live-site polish.

## 124 operator deployment shortcuts

When the Mortis backend or CLI daemon source changes on `124.220.233.126`, use the repo-local deployment entrypoints below instead of ad-hoc copy/restart sequences:

### Docker web stack refresh

```bash
cd /srv/multica
docker compose -f docker-compose.selfhost.yml up -d --build
```

### CLI daemon binary refresh

```bash
cd /srv/multica
make deploy-daemon-binary
```

This target builds `server/cmd/multica`, backs up the current `/usr/local/bin/multica`, replaces it, then automatically restarts `multica-daemon.service` so the live runtime does not stay on the old binary.

### Ping regression quick check

After a daemon binary refresh, inspect the daemon journal for these markers:

- `mode=openclaw-health` → lightweight health ping succeeded
- `next_mode=openclaw-full-agent-fallback` → health probe failed and full-agent fallback was used
- `mode=openclaw-full-agent-fallback` on completion/failure logs → the ping finished on the slower fallback path

## What This File Should Not Absorb

Do not turn this note into:

- a generic self-hosting tutorial
- a complete CLI reference
- a duplicate of `README.md`
- a historical changelog

If a section starts to explain generic setup for new operators, move that material
to `SELF_HOSTING.md` or another supporting guide.
