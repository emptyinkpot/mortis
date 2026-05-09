CREATE TABLE agent_brain_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role_name)
);

CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'observation',
  subject TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  salience DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  metadata JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'qq_user',
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL DEFAULT '',
  trust_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  respect_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  annoyance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  familiarity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role_name, target_type, target_id)
);

CREATE TABLE agent_emotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'neutral',
  energy DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  arousal DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  valence DOUBLE PRECISION NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  goal TEXT NOT NULL,
  priority DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  entry_type TEXT NOT NULL DEFAULT 'thought',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  sender_uin TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  self_id TEXT NOT NULL DEFAULT '',
  message_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, group_id, message_hash)
);

CREATE INDEX agent_memories_lookup_idx ON agent_memories (workspace_id, role_name, last_seen_at DESC);
CREATE INDEX agent_relationships_lookup_idx ON agent_relationships (workspace_id, role_name, target_type, target_id);
CREATE INDEX agent_journals_lookup_idx ON agent_journals (workspace_id, role_name, created_at DESC);
CREATE INDEX agent_transcripts_lookup_idx ON agent_transcripts (workspace_id, group_id, message_time DESC);
