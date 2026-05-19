# Mortis Legacy And Watch Repository References

This document preserves the repository-level identity of historical Mortis
repositories without importing their full histories into the active source tree.

## Active Source

```text
repository: https://github.com/emptyinkpot/mortis
branch: mortis/operator-runtime
current consolidation commit: e3dce2ef64bbdafbe2ce7c93450ed4cf6cba9755
```

## Legacy Source Record

```text
repository: https://github.com/emptyinkpot/mortis-multica-source-legacy
HEAD at consolidation audit: c495be267c1aca9de453c1bae888b7dd5e2c57f9
role: legacy rollback/source record
preferredSource: false
```

This repository is retained for rollback comparison and forensics. Do not deploy
from it unless an explicit rollback task names the repository and commit.

## Watch Mirror

```text
repository: https://github.com/emptyinkpot/mortis-multica-watch
HEAD at consolidation audit: 476c3453113fe62402c4d9e3fafcdd1249e37537
role: sanitized public watch mirror
preferredSource: false
deployFromHere: false
```

This repository is retained only until active watch/notification workflow checks
prove it is unused.

## Consolidation Rule

Do not merge these repositories wholesale into the active source. Migrate only
specific durable docs, scripts, or adapter code after review. The NapCat control
adapter was migrated to:

```text
integrations/napcat-control/
docs/integrations/napcat-control.md
```

## Archive Readiness Assessment

As of the consolidation audit:

- `mortis-napcat-control` durable code has been migrated into this repository.
- Remaining `mortis-multica-watch` references found in old host-control notes are
  examples of the historical watch workflow, not evidence that the watch mirror
  is the active source.
- `mortis-multica-source-legacy` remains useful only as a rollback comparison
  point at commit `c495be267c1aca9de453c1bae888b7dd5e2c57f9`.

Recommended next disposition:

```text
mortis-multica-source-legacy -> archive after backup/export
mortis-multica-watch         -> archive after backup/export
mortis-napcat-control        -> archive after backup/export; migrated into integrations/napcat-control
```

Do not delete these repositories without a separate backup verification step.