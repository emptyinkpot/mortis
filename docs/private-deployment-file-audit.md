---
title: Mortis private deployment file audit
status: canonical-supporting
audience: operators and maintainers
scope: private deployment entrypoint audit
---

# Mortis private deployment file audit

## Purpose

This document audits the files and entrypoints that currently describe, support,
or operate the Mortis private deployment. The goal is to reduce ambiguity
between:

- generic self-hosting
- current private production facts
- compatibility-layer instructions
- legacy or historical entrypoints

## Classification

### Keep as canonical

These should remain active, discoverable, and current:

| File / entrypoint | Reason |
| --- | --- |
| `README.md` | Canonical human control-plane document |
| `README.zh-CN.md` | Canonical Chinese synchronized companion |
| `project.json` | Canonical machine-readable entry |
| `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` | Current Mortis private deployment facts |
| `SELF_HOSTING.md` | Generic repo-supported self-host path |
| `docker-compose.selfhost.yml` | Canonical self-host compose topology |
| `Makefile` | Canonical command entry layer for `selfhost` and `deploy-daemon-binary` |
| `scripts/deploy-daemon-binary.sh` | Canonical private daemon binary refresh helper |

### Keep as compatibility

These are still useful, but should not be treated as the primary source of
private deployment truth:

| File / entrypoint | Why compatibility, not canonical |
| --- | --- |
| `CLI_AND_DAEMON.md` | Useful CLI reference, but not private deployment truth |
| `scripts/install.sh` | Generic install workflow and upstream-facing entry |
| `scripts/install.ps1` | Generic install workflow and upstream-facing entry |
| `SELF_HOSTING_ADVANCED.md` | Useful depth doc, but not the primary operator entry |
| `SELF_HOSTING_AI.md` | AI-executable quick path, but derivative of generic self-host flow |

### Mark as legacy

These should not continue to spread as active production truths:

| File / entrypoint | Legacy reason |
| --- | --- |
| `https://golutra.tengokukk.com` | Redirect-only historical host |
| Any document text equating `localhost:3000/8080` with current Mortis private deployment binds | Generic self-host defaults, not current private runtime facts |
| Any wording that Mortis is fully de-Multica'd | False for current compatibility state |

## Merge / rename recommendations

### No immediate merge

The following should stay separate because they serve different audiences:

- `README.md` vs `SELF_HOSTING.md`
- `README.md` vs `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- `SELF_HOSTING.md` vs `SELF_HOSTING_ADVANCED.md`

### Rename not required yet

The current names are acceptable if their scope stays explicit:

- `SELF_HOSTING.md`
- `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`
- `SELF_HOSTING_ADVANCED.md`

### Candidate future rename

If the private deployment notes continue to grow, consider a future rename to
something more obviously operational, such as:

- `MORTIS_PRIVATE_RUNTIME_NOTES.md`
- `MORTIS_PRIVATE_DEPLOYMENT_OPERATIONS.md`

This is not required now. Current priority is scope clarity, not filename churn.

## Cleanup recommendations

1. Keep `README.md` as the single top-level control-plane narrative
2. Keep `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md` factual and production-specific
3. Keep `SELF_HOSTING.md` generic and repo-supported
4. Avoid duplicating production port/domain facts in advanced and AI helper docs
5. When a new private deployment shortcut is introduced, register it in:
   - `README.md`
   - `project.json`
   - `MORTIS_PRIVATE_DEPLOYMENT_NOTES.md`

## Current conclusion

The repo does not primarily suffer from missing files. It suffers from layered
entrypoints that were historically useful but easy to confuse:

- generic self-host docs
- current Mortis private runtime facts
- upstream-compatible install / CLI instructions

The correct fix is not aggressive deletion. The correct fix is explicit
classification and scope discipline, which is what this audit records.
