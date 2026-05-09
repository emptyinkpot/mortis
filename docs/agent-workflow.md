---
title: Role Workflow
status: canonical-supporting
scope: Role-based Manager / Builder / Tester execution contract
---

# Role Workflow

Mortis roles operate as an engineering team, not as one unlimited super-agent.

## Feature Workflow

```text
Manager role -> Plan
Operator -> Approve
Builder role -> Build
Tester role -> Verify
Manager role -> Report
Operator -> Deploy
```

## Builder Contract

Builder roles receive one approved scope at a time.

They must report:

- changed files
- implementation summary
- tests run
- skipped tests with reason
- residual risks

They must not:

- broaden scope
- change deployment behavior
- claim final verification
- edit files outside the approved issue scope

## Tester Contract

Tester roles verify the work against acceptance criteria.

They must report:

- commands run
- manual checks performed
- pass / fail / blocked verdict
- reproduction notes for failures

Tester agents do not trust Builder summaries as proof.

## Manager Report Format

```text
## Current Goal
## Completed This Round
## Current State
## Failed / Blocked
## Risks
## Recommended Next Step
## Operator Approval Needed
```
