CREATE TABLE manager_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NULL REFERENCES manager_issues(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  project TEXT NOT NULL DEFAULT 'Mortis',
  role TEXT NOT NULL CHECK (role IN ('manager', 'builder', 'tester', 'reviewer', 'deployer')),
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'planned',
    'awaiting_approval',
    'approved',
    'queued',
    'running',
    'built',
    'testing',
    'passed',
    'failed',
    'blocked',
    'ready_for_deploy',
    'deployed',
    'rolled_back',
    'cancelled'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  scope JSONB NOT NULL DEFAULT '{}',
  inputs JSONB NOT NULL DEFAULT '{}',
  constraints JSONB NOT NULL DEFAULT '[]',
  acceptance_criteria JSONB NOT NULL DEFAULT '[]',
  test_plan JSONB NOT NULL DEFAULT '{}',
  execution_plan JSONB NOT NULL DEFAULT '{}',
  assigned_agent JSONB NOT NULL DEFAULT '{}',
  artifacts JSONB NOT NULL DEFAULT '{}',
  report JSONB NOT NULL DEFAULT '{}',
  approval JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manager_issue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES manager_issues(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX manager_issues_workspace_status_idx
  ON manager_issues (workspace_id, status, created_at DESC);

CREATE INDEX manager_issues_parent_idx
  ON manager_issues (parent_id);

CREATE INDEX manager_issue_events_issue_idx
  ON manager_issue_events (issue_id, created_at DESC);
