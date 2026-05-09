# Role AI Organization MVP

Mortis treats Manager AI as the first built-in role in a configurable AI organization system.

The target architecture is:

```text
QQ / Web / internal chat
-> Conversation Bus
-> Role Router
-> Role Registry
-> Manager / Builder / Tester / custom roles
-> Workflow / Issue / Approval / Audit
-> Codex / daemon / CLI / external tools
```

## Core Rule

Role is not Agent.

A role defines responsibility, forbidden actions, permissions, channels, approval policy, and default runtime. An agent or runtime can be bound later as an executor.

## Built-In Roles

- `manager`: plans, routes, asks for approval, reports
- `builder`: implements approved work
- `tester`: verifies independently

## Manager Page Contract

`/:workspaceSlug/manager` is the Manager role console. It must route messages
through the Role Router and must not create legacy Manager issues.

Allowed behavior:

- show the built-in `manager` role definition
- submit `@manager` messages to `/api/roles/route-message`
- show role invocation history for `manager`

Forbidden behavior:

- calling `/api/manager/plan`
- creating Manager / Builder / Tester issues from this page
- falling back to the old Manager issue publisher when the role registry is invalid

The old `/api/manager/*` routes and core manager exports are removed. The
`050_manager_ai_mvp` migration remains only as database history.

## Extensible Roles

Custom roles such as finance, operations, researcher, reviewer, and deployer use the same schema. High-risk actions must become approval requests, not direct execution.

## Conversation Routing

Explicit mentions route directly:

```text
@manager plan the next Mortis milestone
@tester verify the latest deployment
@finance summarize this month server cost
```

If a trusted QQ operator sends a message without a mention, the safe default is Manager.

## Safety Boundary

Natural language from QQ, Web, or internal chat can create a structured role invocation and proposed action. It must not directly deploy, delete data, change production config, or execute payment.

High-risk commands are converted into approval requests.
