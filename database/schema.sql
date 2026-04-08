CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT ',',
  mod_log_channel_id TEXT,
  purge_archive_channel_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS mod_cases (
  case_id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_mod_cases_guild_id ON mod_cases(guild_id);
CREATE INDEX IF NOT EXISTS idx_mod_cases_user_id ON mod_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_cases_action_type ON mod_cases(action_type);

CREATE TABLE IF NOT EXISTS temp_bans (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_temp_bans_expires_at ON temp_bans(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_bans_active ON temp_bans(active);

CREATE TABLE IF NOT EXISTS message_logs (
  message_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  content TEXT,
  attachment_urls TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_logs_channel_id ON message_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_author_id ON message_logs(author_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);

CREATE TABLE IF NOT EXISTS deleted_messages (
  message_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  content TEXT,
  attachment_urls TEXT,
  created_at INTEGER,
  deleted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_channel_id ON deleted_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_author_id ON deleted_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at ON deleted_messages(deleted_at);

CREATE TABLE IF NOT EXISTS edited_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  old_content TEXT,
  new_content TEXT,
  old_attachment_urls TEXT,
  new_attachment_urls TEXT,
  created_at INTEGER,
  edited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edited_messages_message_id ON edited_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_edited_messages_channel_id ON edited_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_edited_messages_author_id ON edited_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_edited_messages_edited_at ON edited_messages(edited_at);

CREATE TABLE IF NOT EXISTS command_role_permissions (
  guild_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, command_name, role_id)
);

CREATE INDEX IF NOT EXISTS idx_command_role_permissions_guild_command
ON command_role_permissions(guild_id, command_name);

CREATE TABLE IF NOT EXISTS afk_status (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  since INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS afk_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  afk_user_id TEXT NOT NULL,
  pinger_user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  message_url TEXT NOT NULL,
  message_preview TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_afk_mentions_lookup
ON afk_mentions(guild_id, afk_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jail_settings (
  guild_id TEXT PRIMARY KEY,
  jail_role_id TEXT,
  jail_channel_id TEXT
);

CREATE TABLE IF NOT EXISTS jailed_users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  jailed_by TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS jailed_user_roles (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, role_id)
);