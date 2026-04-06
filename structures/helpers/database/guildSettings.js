const db = require("../../../database/db");

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT ',',
    mod_log_channel_id TEXT,
    purge_archive_channel_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`);

const columns = db.prepare(`PRAGMA table_info(guild_settings)`).all();
const hasPurgeArchiveColumn = columns.some((c) => c.name === "purge_archive_channel_id");

if (!hasPurgeArchiveColumn) {
  db.exec(`ALTER TABLE guild_settings ADD COLUMN purge_archive_channel_id TEXT`);
}

const getGuildSettingsStmt = db.prepare(`
  SELECT *
  FROM guild_settings
  WHERE guild_id = ?
`);

const ensureGuildSettingsStmt = db.prepare(`
  INSERT OR IGNORE INTO guild_settings (guild_id)
  VALUES (?)
`);

const setModLogChannelStmt = db.prepare(`
  UPDATE guild_settings
  SET mod_log_channel_id = ?
  WHERE guild_id = ?
`);

const setPurgeArchiveChannelStmt = db.prepare(`
  UPDATE guild_settings
  SET purge_archive_channel_id = ?
  WHERE guild_id = ?
`);

function ensureGuildSettings(guildId) {
  ensureGuildSettingsStmt.run(guildId);
  return getGuildSettingsStmt.get(guildId);
}

function getGuildSettings(guildId) {
  return getGuildSettingsStmt.get(guildId) || ensureGuildSettings(guildId);
}

function setModLogChannel(guildId, channelId) {
  ensureGuildSettings(guildId);
  setModLogChannelStmt.run(channelId, guildId);
  return getGuildSettings(guildId);
}

function setPurgeArchiveChannel(guildId, channelId) {
  ensureGuildSettings(guildId);
  setPurgeArchiveChannelStmt.run(channelId, guildId);
  return getGuildSettings(guildId);
}

module.exports = {
  ensureGuildSettings,
  getGuildSettings,
  setModLogChannel,
  setPurgeArchiveChannel,
};