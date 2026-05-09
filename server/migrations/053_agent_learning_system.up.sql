CREATE TABLE agent_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  credibility DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'knowledge',
  content TEXT NOT NULL,
  source_knowledge_id UUID REFERENCES agent_knowledge_items(id) ON DELETE SET NULL,
  salience DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE agent_social_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL DEFAULT '',
  observation_type TEXT NOT NULL DEFAULT 'group_style',
  summary TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  metadata JSONB NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_learning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL DEFAULT 'watcher',
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  query TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  result_summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_knowledge_items_lookup_idx ON agent_knowledge_items (workspace_id, observed_at DESC);
CREATE INDEX agent_memory_items_lookup_idx ON agent_memory_items (workspace_id, role_name, salience DESC, created_at DESC);
CREATE INDEX agent_social_observations_lookup_idx ON agent_social_observations (workspace_id, group_id, observed_at DESC);
CREATE INDEX agent_learning_jobs_lookup_idx ON agent_learning_jobs (workspace_id, role_name, status, scheduled_at DESC);
