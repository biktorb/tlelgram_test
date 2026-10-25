-- The group chat a run was started from (Telegram's chat_instance), for chat leaderboards.
ALTER TABLE runs ADD COLUMN chat_instance TEXT;
CREATE INDEX runs_chat_recent ON runs (chat_instance, updated_at) WHERE chat_instance IS NOT NULL;
