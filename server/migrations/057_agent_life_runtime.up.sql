CREATE TABLE agent_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  emotion TEXT NOT NULL DEFAULT 'neutral',
  meme_potential DOUBLE PRECISION NOT NULL DEFAULT 0,
  technical_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  social_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('new', 'saved', 'shared', 'ignored', 'digested')) DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  feed_item_id UUID NULL REFERENCES agent_feed_items(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('meme', 'video', 'repo', 'article', 'file', 'research_card', 'link')),
  title TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  storage_uri TEXT NOT NULL DEFAULT '',
  share_trigger TEXT NOT NULL DEFAULT '',
  social_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  technical_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_shared_at TIMESTAMPTZ
);

CREATE TABLE agent_life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'neutral',
  current_interest TEXT NOT NULL DEFAULT '',
  social_impulse DOUBLE PRECISION NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  related_feed_item_id UUID NULL REFERENCES agent_feed_items(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_feed_items_lookup_idx ON agent_feed_items (workspace_id, source_type, observed_at DESC);
CREATE INDEX agent_feed_items_value_idx ON agent_feed_items (workspace_id, status, social_value DESC, technical_value DESC, observed_at DESC);
CREATE INDEX agent_saved_items_role_idx ON agent_saved_items (workspace_id, role_name, created_at DESC);
CREATE INDEX agent_life_events_role_idx ON agent_life_events (workspace_id, role_name, created_at DESC);

INSERT INTO studio_state (
  workspace_id, state_key, state_type, status, owner_role, summary, current_value, next_action, artifact_required, metadata
)
SELECT
  w.id,
  'digital_human_behavior_layer',
  'life_runtime',
  'partial',
  'watcher',
  'AI Life Runtime now has durable feed, saved-item, and life-event tables. It captures QQ public feed signals and idle life pulses, but external Bilibili/GitHub/blog/browser ingestion and real media/file sharing are still missing.',
  '{"tables":["agent_feed_items","agent_saved_items","agent_life_events"],"emotion_driven_expression":true,"random_expression":false,"external_ingestion":false,"media_sharing":false}'::jsonb,
  'Implement Watcher scheduled browser/Bilibili/GitHub/blog ingestion, emotion-driven saved-item sharing, OpenList media cards, and QQ file/image sending.',
  true,
  '{"source":"Digital Human Behavior Layer recommendation"}'::jsonb
FROM workspace w
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
