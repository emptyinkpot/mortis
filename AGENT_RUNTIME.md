# Agent Runtime

Mortis agent runtime work is governed by stable execution, artifact evidence, and operator approval.

## P0 Runtime Chain

```text
operator task
-> dispatcher
-> builder-local-codex
-> isolated action workspace
-> commit + diff + test report
-> tester-local-verifier
-> verification report
-> channel / web summary
```

## Current Runtime Roles

Only these roles are first-class in the stable execution chain:

- Dispatcher
- Builder
- Tester

Additional personas, memory systems, social behavior, and multi-agent scheduling are deferred unless they strengthen this chain.

## Task Contract

Executable work should have an explicit contract:

```json
{
  "action_type": "code_change",
  "owner": "builder",
  "objective": "fix a concrete behavior",
  "acceptance": ["observable success condition"],
  "commands": ["npm test", "npm run build"],
  "artifact_required": true,
  "artifact_types": ["commit", "diff", "test_report"]
}
```

## Evidence Rule

Builder cannot finish with only "done". Tester cannot finish with only "looks good".

Required evidence should include commits, diffs, logs, reports, and verification results.

## Runtime References

- `docs/architecture/stable-execution-chain.md`
- `docs/architecture/agent-os-core.md`
- `docs/architecture/agent-society-runtime.md`
- `docs/operations/current-runtime-map.md`
