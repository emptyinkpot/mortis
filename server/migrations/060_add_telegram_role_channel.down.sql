DELETE FROM role_channels WHERE channel = 'telegram';

UPDATE roles
SET allowed_channels = (
  SELECT COALESCE(jsonb_agg(channel), '[]'::jsonb)
  FROM jsonb_array_elements_text(roles.allowed_channels) AS channel
  WHERE channel <> 'telegram'
)
WHERE allowed_channels ? 'telegram';

ALTER TABLE role_channels DROP CONSTRAINT IF EXISTS role_channels_channel_check;
ALTER TABLE role_channels ADD CONSTRAINT role_channels_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api'));

ALTER TABLE role_invocations DROP CONSTRAINT IF EXISTS role_invocations_channel_check;
ALTER TABLE role_invocations ADD CONSTRAINT role_invocations_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api'));

ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_channel_check;
ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api'));

ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS conversation_threads_channel_check;
ALTER TABLE conversation_threads ADD CONSTRAINT conversation_threads_channel_check CHECK (channel IN ('web', 'internal_chat', 'qq', 'api'));
