CREATE TABLE studio_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  state_key TEXT NOT NULL,
  state_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'missing', 'blocked', 'operator_only')) DEFAULT 'partial',
  owner_role TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  current_value JSONB NOT NULL DEFAULT '{}',
  next_action TEXT NOT NULL DEFAULT '',
  artifact_required BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, state_key)
);

CREATE INDEX studio_state_workspace_status_idx ON studio_state (workspace_id, status, state_type);
CREATE INDEX studio_state_workspace_updated_idx ON studio_state (workspace_id, updated_at DESC);

INSERT INTO studio_state (
  workspace_id, state_key, state_type, status, owner_role, summary, current_value, next_action, artifact_required, metadata
)
SELECT
  w.id,
  item.state_key,
  item.state_type,
  item.status,
  item.owner_role,
  item.summary,
  item.current_value::jsonb,
  item.next_action,
  item.artifact_required,
  item.metadata::jsonb
FROM workspace w
CROSS JOIN (
  VALUES
    (
      'persona_layer',
      'runtime_layer',
      'partial',
      'ceo',
      'QQ living agents can speak as CEO/Builder/Tester/Watcher through GLM, but must not treat QQ as the private work bus.',
      '{"runtime":"glm","group_id":"474958794","roles":["ceo","builder","tester","watcher"]}',
      'Keep GLM for social/research/planning and route real work into action contracts.',
      true,
      '{"source":"AI Studio OS recommendation"}'
    ),
    (
      'execution_layer',
      'runtime_layer',
      'partial',
      'builder',
      'Builder actions can enter dispatcher -> builder-local-codex -> worker checkout -> commit/test-report artifacts.',
      '{"runtime":"builder-local-codex","work_root":"/srv/multica/agent-workspaces","repo_url":"file:///source"}',
      'Formalize PR/push policy and keep every execution artifact-first.',
      true,
      '{"source":"server/internal/roles/builder_runtime.go"}'
    ),
    (
      'tester_runtime',
      'runtime_layer',
      'partial',
      'tester',
      'tester-local-verifier exists and can run contract commands against a Builder workspace, but CI/staging and reliable branch handoff remain incomplete.',
      '{"runtime":"tester-local-verifier","can_run_contract_commands":true,"ci_integrated":false,"staging_integrated":false}',
      'Connect Builder completion to Tester action creation with branch, commit, workspace, and test matrix.',
      true,
      '{"source":"server/internal/roles/tester_runtime.go"}'
    ),
    (
      'ci_results',
      'observability',
      'missing',
      'tester',
      'No CI provider URL/API/token source is recorded for agent reads.',
      '{}',
      'Record CI provider, project id, readonly token source, and failure-log redaction policy.',
      true,
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'logs_monitoring',
      'observability',
      'operator_only',
      'ceo',
      'Backend docker logs are reachable by the operator/server execution path; no stable read-only dashboard is configured.',
      '{"backend_logs":"docker compose logs backend","dashboard_url":""}',
      'Add read-only log/monitoring dashboard address, retention, role access policy, and redaction rules.',
      true,
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'issue_tracker',
      'work_tracking',
      'missing',
      'ceo',
      'No durable issue tracker write path is configured for CEO/Builder/Tester/Watcher.',
      '{}',
      'Record issue tracker URL, label scheme, write token source, and owner rules.',
      true,
      '{"source":"docs/private-ai-studio-permissions-and-addresses.json"}'
    ),
    (
      'watcher_ingestion',
      'knowledge',
      'missing',
      'watcher',
      'Watcher has QQ/OneBot and knowledge-table hooks, but scheduled browser/Bilibili/GitHub/blog ingestion is not productized.',
      '{"knowledge_tables":["agent_knowledge_items","agent_memory_items","agent_learning_jobs"],"scheduled_ingestion":false}',
      'Implement browser/search/Bilibili/GitHub ingestion jobs and export research cards to OpenList.',
      true,
      '{"source":"AI Studio OS recommendation"}'
    ),
    (
      'artifact_first_workflow',
      'delivery_policy',
      'partial',
      'ceo',
      'studio_artifacts records produced work. QQ summaries must cite artifact id/path, verification status, and remaining risk.',
      '{"table":"studio_artifacts","accepted_artifacts":["diff","commit","test_report","bug_report","design_note","acceptance_checklist","benchmark","research_card","deployment_note"]}',
      'Reject claims of completion that have no action, artifact, command evidence, or explicit blocked reason.',
      true,
      '{"source":"AI Studio OS recommendation"}'
    )
) AS item(state_key, state_type, status, owner_role, summary, current_value, next_action, artifact_required, metadata)
ON CONFLICT (workspace_id, state_key) DO UPDATE SET
  state_type = EXCLUDED.state_type,
  status = EXCLUDED.status,
  owner_role = EXCLUDED.owner_role,
  summary = EXCLUDED.summary,
  current_value = EXCLUDED.current_value,
  next_action = EXCLUDED.next_action,
  artifact_required = EXCLUDED.artifact_required,
  metadata = EXCLUDED.metadata,
  updated_at = now();
