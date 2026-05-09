ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS conversation_threads_channel_check;
ALTER TABLE conversation_threads ADD CONSTRAINT conversation_threads_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api', 'telegram'));

ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_channel_check;
ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api', 'telegram'));

ALTER TABLE role_invocations DROP CONSTRAINT IF EXISTS role_invocations_channel_check;
ALTER TABLE role_invocations ADD CONSTRAINT role_invocations_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api', 'telegram'));

ALTER TABLE role_channels DROP CONSTRAINT IF EXISTS role_channels_channel_check;
ALTER TABLE role_channels ADD CONSTRAINT role_channels_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api', 'telegram'));

UPDATE roles
SET allowed_channels = (
  SELECT jsonb_agg(DISTINCT channel)
  FROM jsonb_array_elements_text(roles.allowed_channels || '["telegram"]'::jsonb) AS channel
)
WHERE built_in = true
  AND name IN ('manager', 'builder', 'tester');
