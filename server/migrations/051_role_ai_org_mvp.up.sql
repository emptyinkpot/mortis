CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  responsibilities JSONB NOT NULL DEFAULT '[]',
  forbidden_actions JSONB NOT NULL DEFAULT '[]',
  permissions JSONB NOT NULL DEFAULT '[]',
  default_runtime TEXT NOT NULL DEFAULT 'manual',
  allowed_channels JSONB NOT NULL DEFAULT '[]',
  approval_policy TEXT NOT NULL DEFAULT 'operator_required',
  system_prompt TEXT NOT NULL DEFAULT '',
  built_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission)
);

CREATE TABLE role_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'internal_chat', 'qq', 'api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, channel)
);

CREATE TABLE role_runtime_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  runtime TEXT NOT NULL DEFAULT 'manual',
  agent_id UUID NULL REFERENCES agent(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'internal_chat', 'qq', 'api')),
  external_thread_key TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, channel, external_thread_key)
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'internal_chat', 'qq', 'api')),
  sender_type TEXT NOT NULL DEFAULT 'operator',
  sender_id TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  external_message_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  message_id UUID NULL REFERENCES conversation_messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'internal_chat', 'qq', 'api')),
  status TEXT NOT NULL CHECK (status IN ('routed', 'queued', 'running', 'completed', 'failed', 'blocked')) DEFAULT 'routed',
  command_type TEXT NOT NULL DEFAULT 'role_message',
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  invocation_id UUID NOT NULL REFERENCES role_invocations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('proposed', 'awaiting_approval', 'approved', 'rejected', 'executed', 'cancelled')) DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  role_action_id UUID NOT NULL REFERENCES role_actions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'cancelled')) DEFAULT 'awaiting_approval',
  requested_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NULL,
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX roles_workspace_idx ON roles (workspace_id, name);
CREATE INDEX conversation_messages_workspace_idx ON conversation_messages (workspace_id, created_at DESC);
CREATE INDEX role_invocations_workspace_idx ON role_invocations (workspace_id, created_at DESC);
CREATE INDEX role_actions_workspace_idx ON role_actions (workspace_id, created_at DESC);
CREATE INDEX approval_requests_workspace_idx ON approval_requests (workspace_id, status, created_at DESC);
CREATE INDEX audit_events_workspace_idx ON audit_events (workspace_id, created_at DESC);
