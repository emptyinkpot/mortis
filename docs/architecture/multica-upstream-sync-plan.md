# Multica Upstream Sync And Fork Identity Plan

This repository should be treated as a downstream fork of Multica, not as an unrelated Mortis codebase.

## Current Truth

- Upstream: `https://github.com/multica-ai/multica`
- Downstream repository: `https://github.com/emptyinkpot/mortis`
- Remote working tree: `ubuntu@124.220.233.126:/srv/multica`
- Upstream snapshot inspected: `e076bba fix(runtimes): price OpenAI Codex / GPT models so cost stops showing $0 (#2334)`
- Downstream snapshot inspected: `5d6e045 docs: record external gateway plugin repo`

The current downstream repository already says it is based on Multica, but the product identity is still too Mortis-centered. The honest model is:

```text
Multica upstream
-> private downstream fork
-> Mortis operator-runtime branch/features
```

## What Changes Conceptually

Do not describe this repository as a fully independent product.

Preferred wording:

```text
This is a private Multica fork with Mortis operator-runtime extensions.
```

Avoid wording:

```text
Mortis is a separate system unrelated to Multica.
```

## Why Direct Overwrite Is Unsafe

File inventory comparison:

| Set | Count |
| --- | ---: |
| Upstream Multica files | 1542 |
| Downstream fork files | 1177 |
| Upstream-only files | 636 |
| Downstream-only files | 271 |

Upstream has significant new work in:

- desktop runtime pages and update handling
- docs i18n and docs site structure
- agent detail/runtime/skill pages
- runtime health/model/local-skill APIs
- many newer migrations up to `080_*`
- package-level agent/runtimes refactors

Downstream has private extensions in:

- `.runtime/` coordination skeleton
- `AGENT_WORKFLOW.md`, `AI_CONTEXT.md`, `contracts/agent-*`
- Telegram/n8n/operator gateway docs and handlers
- Builder/Tester runtime artifacts
- QQ/NapCat legacy bridge
- Agent OS / control-plane / roles / Atramenti pages
- Mortis private deployment notes and topology docs

A blind copy of upstream over downstream would likely delete private operator-runtime work. A blind merge of downstream over upstream would bury upstream fixes.

## Recommended Branch Model

```text
upstream/main
  read-only mirror of multica-ai/multica

main
  deployed private downstream fork

sync/upstream-<date>
  branch used to merge/rebase upstream into downstream

feature/mortis-operator-runtime
  conceptual name for private Mortis extensions
```

If the repository is renamed later, prefer a name like:

```text
multica-operator-fork
multica-mortis-operator-branch
multica-private-operator-runtime
```

The codebase should keep `multica` package names, CLI names, Go module paths, and compatibility identifiers unless there is a deliberate upstream-aware rename plan.

## Merge Strategy

### P0: Identity correction

Update docs and machine-readable metadata to say:

```text
projectName: Multica private fork
forkCodename: Mortis
upstream: multica-ai/multica
```

Also fix stale local source references, especially in `README.zh-CN.md`.

### P1: Upstream mirror setup

Because server-side `git fetch upstream main` is currently slow/unreliable, use one of these approaches:

1. Keep a local upstream clone for audit and create patch bundles.
2. Retry remote fetch during a quiet window.
3. Use GitHub Actions or a temporary runner to create a sync branch.

Do not run multiple concurrent `git fetch` processes inside `/srv/multica`.

### P2: Low-conflict upstream imports

Bring in upstream-only files that are unlikely to conflict with private runtime:

- docs i18n structure if still desired
- desktop update/runtime utility files
- package-level tests that do not conflict
- `.vercelignore`
- newer CI files only after checking private workflow compatibility

### P3: High-conflict code merge

Merge these areas manually:

- `server/internal/handler/runtime*`
- `server/pkg/agent/*`
- `packages/core/agents/*`
- `packages/core/runtimes/*`
- `packages/views/agents/*`
- `packages/views/runtimes/*`
- migrations after `060_*`

Each area needs compile/test verification before deployment.

### P4: Upstream contribution split

Private Mortis-specific work should stay downstream. Generic improvements should be extracted into upstream PRs against `multica-ai/multica`.

Potential upstreamable areas:

- runtime pricing/model fixes if not already upstream
- generic Builder/Tester artifact improvements
- generic Telegram/operator webhook abstractions only if not branded/private
- docs clarifying managed agent runtime operations

Do not upstream:

- private server hostnames
- single-operator deployment assumptions
- Mortis branding
- private n8n/Telegram secrets or workflow details
- AstrBot private integration specifics unless made generic

## First Concrete Step

Make the repository identity honest before touching large code merges:

1. Update `project.json`.
2. Update `README.md` and `README.zh-CN.md` top sections.
3. Add this sync plan under `docs/architecture/`.
4. Keep runtime names compatible: CLI/package/module names remain `multica`.

After that, create a dedicated upstream sync branch and import upstream changes in batches.
