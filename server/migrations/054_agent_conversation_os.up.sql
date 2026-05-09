CREATE TABLE agent_shared_threads (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL DEFAULT '',
  source_message_hash TEXT NOT NULL DEFAULT '',
  source_message_id TEXT NOT NULL DEFAULT '',
  source_sender_uin TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL,
  participants TEXT[] NOT NULL DEFAULT '{}',
  decisions TEXT[] NOT NULL DEFAULT '{}',
  open_questions TEXT[] NOT NULL DEFAULT '{}',
  current_plan TEXT[] NOT NULL DEFAULT '{}',
  consensus_state JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  closure_reason TEXT NOT NULL DEFAULT '',
  blocked_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE agent_cognitive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES agent_shared_threads(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL DEFAULT '',
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX agent_shared_threads_lookup_idx ON agent_shared_threads (workspace_id, group_id, updated_at DESC);
CREATE INDEX agent_shared_threads_status_idx ON agent_shared_threads (workspace_id, status, updated_at DESC);
CREATE INDEX agent_cognitive_events_thread_idx ON agent_cognitive_events (workspace_id, thread_id, created_at);
CREATE INDEX agent_cognitive_events_queue_idx ON agent_cognitive_events (workspace_id, status, created_at);
