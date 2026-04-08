const db = require("../../../database/db");

db.exec(`
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
`);

const setAfkStmt = db.prepare(`
  INSERT INTO afk_status (
    guild_id,
    user_id,
    reason,
    since
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    reason = excluded.reason,
    since = excluded.since
`);

const getAfkStmt = db.prepare(`
  SELECT *
  FROM afk_status
  WHERE guild_id = ? AND user_id = ?
`);

const clearAfkStmt = db.prepare(`
  DELETE FROM afk_status
  WHERE guild_id = ? AND user_id = ?
`);

const addAfkMentionStmt = db.prepare(`
  INSERT INTO afk_mentions (
    guild_id,
    afk_user_id,
    pinger_user_id,
    channel_id,
    message_id,
    message_url,
    message_preview,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getAfkMentionsStmt = db.prepare(`
  SELECT *
  FROM afk_mentions
  WHERE guild_id = ? AND afk_user_id = ?
  ORDER BY created_at DESC
`);

const clearAfkMentionsStmt = db.prepare(`
  DELETE FROM afk_mentions
  WHERE guild_id = ? AND afk_user_id = ?
`);

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function setAfk(guildId, userId, reason = null) {
  const since = nowUnix();
  setAfkStmt.run(guildId, userId, reason || null, since);
  return getAfk(guildId, userId);
}

function getAfk(guildId, userId) {
  return getAfkStmt.get(guildId, userId) || null;
}

function clearAfk(guildId, userId) {
  clearAfkStmt.run(guildId, userId);
}

function addAfkMention({
  guildId,
  afkUserId,
  pingerUserId,
  channelId,
  messageId,
  messageUrl,
  messagePreview = "",
}) {
  addAfkMentionStmt.run(
    guildId,
    afkUserId,
    pingerUserId,
    channelId,
    messageId,
    messageUrl,
    messagePreview,
    nowUnix()
  );
}

function getAfkMentions(guildId, userId) {
  return getAfkMentionsStmt.all(guildId, userId);
}

function clearAfkMentions(guildId, userId) {
  clearAfkMentionsStmt.run(guildId, userId);
}

module.exports = {
  setAfk,
  getAfk,
  clearAfk,
  addAfkMention,
  getAfkMentions,
  clearAfkMentions,
};