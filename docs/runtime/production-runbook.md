# Mortis Production Runbook

This runbook records the production-facing identity for the active Mortis source line. It is an orientation document, not a secret store.

## Runtime Identity

```yaml
repository: https://github.com/emptyinkpot/mortis-multica-source
role: ACTIVE Mortis operator-runtime source line
branch: mortis/operator-runtime
publicUrl: https://mortis.tengokukk.com
runtimeServer: ubuntu@124.220.233.126
runtimeRoot: /srv/multica
backendBind: 127.0.0.1:8088
frontendBind: 127.0.0.1:3300
aiGatewayBaseUrl: https://sub2api.tengokukk.com/v1
```

## Source And Deployment Boundary

- Active source work belongs in `mortis-multica-source`.
- The shared remote workspace and IDE topology is governed by `code-server-workspace-infra`.
- Ecosystem-level repository relationships are governed by `DataBase`.
- `mortis-multica-source-legacy` is a legacy source record for rollback or forensics.
- `mortis-multica-watch` is a sanitized watch mirror and must not be used for deployment.

## Operational Notes

- Keep provider keys, database credentials, tokens, cookies, and TLS material outside Git.
- Use `sub2api` as the OpenAI-compatible AI gateway where Mortis needs external model access.
- Confirm live process managers, reverse proxy files, and environment variables on the runtime server before changing production behavior.
- Prefer remote-first edits and verification for production-affecting work.

## Verification Checklist

- `project.json` parses as JSON.
- README identity card still names this repository as the active forward source.
- Runtime URL still resolves to `https://mortis.tengokukk.com`.
- No secret-like values are introduced into repository docs.
