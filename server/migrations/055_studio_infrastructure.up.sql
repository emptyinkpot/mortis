CREATE TABLE studio_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  credential_source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('available', 'partial', 'missing', 'operator_only')) DEFAULT 'missing',
  role_permissions JSONB NOT NULL DEFAULT '{}',
  audit_required BOOLEAN NOT NULL DEFAULT false,
  gap TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, resource_key)
);

CREATE TABLE studio_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_action_id UUID NULL REFERENCES role_actions(id) ON DELETE SET NULL,
  invocation_id UUID NULL REFERENCES role_invocations(id) ON DELETE SET NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  uri TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('planned', 'created', 'verified', 'failed', 'blocked')) DEFAULT 'created',
  produced_by TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX studio_resources_workspace_status_idx ON studio_resources (workspace_id, status, resource_type);
CREATE INDEX studio_artifacts_workspace_action_idx ON studio_artifacts (workspace_id, role_action_id, created_at DESC);
CREATE INDEX studio_artifacts_workspace_thread_idx ON studio_artifacts (workspace_id, thread_id, created_at DESC);

INSERT INTO studio_resources (
  workspace_id, resource_key, resource_type, address, credential_source, status, role_permissions, audit_required, gap, metadata
)
SELECT
  w.id,
  item.resource_key,
  item.resource_type,
  item.address,
  item.credential_source,
  item.status,
  item.role_permissions::jsonb,
  item.audit_required,
  item.gap,
  item.metadata::jsonb
FROM workspace w
CROSS JOIN (
  VALUES
    (
      'repository',
      'repo',
      '/srv/multica; /source:ro; file:///source; /srv/multica/agent-workspaces',
      'server filesystem and dispatcher runtime',
      'partial',
      '{"ceo":{"read":true,"write":false},"builder":{"read":true,"write_dev_branch":true,"write_main":false},"tester":{"read":true,"write":false},"watcher":{"read":true,"write":false}}',
      false,
      'Remote push/PR flow and explicit per-action branch allocation are not fully formalized.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'requirements_and_docs',
      'docs',
      'README.md, README.zh-CN.md, docs/',
      'repo read access',
      'partial',
      '{"ceo":{"read":true,"write":true},"builder":{"read":true,"write":false},"tester":{"read":true,"write":true},"watcher":{"read":true,"write":true}}',
      false,
      'No single canonical product/spec index yet.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'test_environment',
      'test_env',
      '',
      '',
      'missing',
      '{"ceo":{"read":true,"write":false},"builder":{"read":true,"write":false},"tester":{"read":true,"write":false},"watcher":{"read":false,"write":false}}',
      false,
      'Need staging/dev URL, API base, test accounts, seed data, and command matrix.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'ci_results',
      'ci',
      '',
      '',
      'missing',
      '{"ceo":{"read":true,"write":false},"builder":{"read":true,"write":false},"tester":{"read":true,"write":false},"watcher":{"read":false,"write":false}}',
      false,
      'Need CI provider URL/API, project identifier, readonly token source, and failure-log redaction policy.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'logs_and_monitoring',
      'logs',
      'backend docker logs available to server operators; no stable dashboard URL configured',
      'operator SSH today; dashboard token not configured',
      'operator_only',
      '{"ceo":{"read":true,"write":false,"audit_required":true},"builder":{"read":true,"write":false,"audit_required":true},"tester":{"read":true,"write":false,"audit_required":true},"watcher":{"read":false,"write":false}}',
      true,
      'Need read-only log/monitoring dashboard address, role access policy, retention, and secret redaction.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'issue_tracker',
      'issue',
      '',
      '',
      'missing',
      '{"ceo":{"read":true,"write":true},"builder":{"read":true,"write":true},"tester":{"read":true,"write":true},"watcher":{"read":true,"write":true}}',
      false,
      'Need issue URL, label scheme, write token source, and owner rules.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'production',
      'production',
      'ubuntu@124.220.233.126 /srv/multica',
      'operator-controlled SSH only',
      'operator_only',
      '{"ceo":{"read_emergency":true,"write":false,"audit_required":true},"builder":{"read_emergency":true,"write":false,"audit_required":true},"tester":{"read_emergency":true,"write":false,"audit_required":true},"watcher":{"read_emergency":false,"write":false,"audit_required":true}}',
      true,
      'Do not grant production write to QQ personas. If needed later, create audited break-glass read-only access first.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'external_research_ingestion',
      'research',
      '',
      '',
      'missing',
      '{"watcher":{"read":true,"write_knowledge_cards":true},"ceo":{"read":true,"write":false},"builder":{"read":true,"write":false},"tester":{"read":true,"write":false}}',
      false,
      'Need browser/search/Bilibili/GitHub ingestion jobs, source credibility scoring, and OpenList knowledge-card export.',
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    )
) AS item(resource_key, resource_type, address, credential_source, status, role_permissions, audit_required, gap, metadata)
ON CONFLICT (workspace_id, resource_key) DO NOTHING;
