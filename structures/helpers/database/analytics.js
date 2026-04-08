const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "../../../database/king.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

function todayKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureAnalyticsTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_daily_messages (
      guild_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_channel_daily_messages (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, channel_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_user_daily_messages (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_daily_reactions (
      guild_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      reaction_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_command_usage_daily (
      guild_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      day_key TEXT NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, command_name, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_active_voice_sessions (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS analytics_voice_daily (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      seconds_total INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id, channel_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS analytics_mod_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_id TEXT,
      moderator_id TEXT,
      reason TEXT,
      created_at INTEGER NOT NULL,
      day_key TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_mod_actions_guild_day
      ON analytics_mod_actions (guild_id, day_key);

    CREATE INDEX IF NOT EXISTS idx_analytics_voice_daily_guild_day
      ON analytics_voice_daily (guild_id, day_key);

    CREATE INDEX IF NOT EXISTS idx_analytics_command_usage_daily_guild_day
      ON analytics_command_usage_daily (guild_id, day_key);
  `);
}

const incDailyMessagesStmt = db.prepare(`
  INSERT INTO analytics_daily_messages (guild_id, day_key, message_count)
  VALUES (?, ?, 1)
  ON CONFLICT(guild_id, day_key)
  DO UPDATE SET message_count = message_count + 1
`);

const incChannelMessagesStmt = db.prepare(`
  INSERT INTO analytics_channel_daily_messages (guild_id, channel_id, day_key, message_count)
  VALUES (?, ?, ?, 1)
  ON CONFLICT(guild_id, channel_id, day_key)
  DO UPDATE SET message_count = message_count + 1
`);

const incUserMessagesStmt = db.prepare(`
  INSERT INTO analytics_user_daily_messages (guild_id, user_id, day_key, message_count)
  VALUES (?, ?, ?, 1)
  ON CONFLICT(guild_id, user_id, day_key)
  DO UPDATE SET message_count = message_count + 1
`);

const incDailyReactionsStmt = db.prepare(`
  INSERT INTO analytics_daily_reactions (guild_id, day_key, reaction_count)
  VALUES (?, ?, 1)
  ON CONFLICT(guild_id, day_key)
  DO UPDATE SET reaction_count = reaction_count + 1
`);

const incCommandUsageStmt = db.prepare(`
  INSERT INTO analytics_command_usage_daily (guild_id, command_name, day_key, usage_count)
  VALUES (?, ?, ?, 1)
  ON CONFLICT(guild_id, command_name, day_key)
  DO UPDATE SET usage_count = usage_count + 1
`);

const upsertActiveVoiceStmt = db.prepare(`
  INSERT INTO analytics_active_voice_sessions (guild_id, user_id, channel_id, joined_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id)
  DO UPDATE SET channel_id = excluded.channel_id, joined_at = excluded.joined_at
`);

const getActiveVoiceStmt = db.prepare(`
  SELECT guild_id, user_id, channel_id, joined_at
  FROM analytics_active_voice_sessions
  WHERE guild_id = ? AND user_id = ?
`);

const deleteActiveVoiceStmt = db.prepare(`
  DELETE FROM analytics_active_voice_sessions
  WHERE guild_id = ? AND user_id = ?
`);

const addVoiceSecondsStmt = db.prepare(`
  INSERT INTO analytics_voice_daily (guild_id, user_id, channel_id, day_key, seconds_total)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id, channel_id, day_key)
  DO UPDATE SET seconds_total = seconds_total + excluded.seconds_total
`);

const insertModActionStmt = db.prepare(`
  INSERT INTO analytics_mod_actions (
    guild_id,
    action_type,
    target_id,
    moderator_id,
    reason,
    created_at,
    day_key
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function recordMessage({ guildId, channelId, userId, createdAt = new Date() }) {
  if (!guildId || !channelId || !userId) return;
  const dayKey = todayKey(createdAt);

  const tx = db.transaction(() => {
    incDailyMessagesStmt.run(guildId, dayKey);
    incChannelMessagesStmt.run(guildId, channelId, dayKey);
    incUserMessagesStmt.run(guildId, userId, dayKey);
  });

  tx();
}

function recordReaction({ guildId, createdAt = new Date() }) {
  if (!guildId) return;
  const dayKey = todayKey(createdAt);
  incDailyReactionsStmt.run(guildId, dayKey);
}

function recordCommandUse({ guildId, commandName, createdAt = new Date() }) {
  if (!guildId || !commandName) return;
  const dayKey = todayKey(createdAt);
  incCommandUsageStmt.run(guildId, commandName, dayKey);
}

function startVoiceSession({ guildId, userId, channelId, joinedAt = Date.now() }) {
  if (!guildId || !userId || !channelId) return;
  upsertActiveVoiceStmt.run(guildId, userId, channelId, joinedAt);
}

function endVoiceSession({ guildId, userId, endedAt = Date.now() }) {
  if (!guildId || !userId) return;

  const active = getActiveVoiceStmt.get(guildId, userId);
  if (!active) return;

  deleteActiveVoiceStmt.run(guildId, userId);

  const seconds = Math.max(0, Math.floor((endedAt - active.joined_at) / 1000));
  if (!seconds) return;

  const dayKey = todayKey(new Date(active.joined_at));
  addVoiceSecondsStmt.run(guildId, userId, active.channel_id, dayKey, seconds);
}

function moveVoiceSession({ guildId, userId, newChannelId, movedAt = Date.now() }) {
  if (!guildId || !userId || !newChannelId) return;
  endVoiceSession({ guildId, userId, endedAt: movedAt });
  startVoiceSession({ guildId, userId, channelId: newChannelId, joinedAt: movedAt });
}

function recordModerationAction({
  guildId,
  actionType,
  targetId = null,
  moderatorId = null,
  reason = null,
  createdAt = Date.now(),
}) {
  if (!guildId || !actionType) return;

  const dayKey = todayKey(new Date(createdAt));
  insertModActionStmt.run(
    guildId,
    actionType,
    targetId,
    moderatorId,
    reason,
    createdAt,
    dayKey
  );
}

function getDateKeysForDays(days = 30) {
  const out = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    out.push(todayKey(d));
  }

  return out;
}

function fillSeries(rows, keyField, valueField, keys) {
  const map = new Map(rows.map((row) => [row[keyField], row[valueField]]));
  return keys.map((key) => ({
    day: key,
    value: Number(map.get(key) || 0),
  }));
}

function getAnalyticsSummary(guildId, days = 30) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  const messages = db
    .prepare(`
      SELECT COALESCE(SUM(message_count), 0) AS total
      FROM analytics_daily_messages
      WHERE guild_id = ? AND day_key >= ?
    `)
    .get(guildId, fromDay)?.total || 0;

  const reactions = db
    .prepare(`
      SELECT COALESCE(SUM(reaction_count), 0) AS total
      FROM analytics_daily_reactions
      WHERE guild_id = ? AND day_key >= ?
    `)
    .get(guildId, fromDay)?.total || 0;

  const voiceSeconds = db
    .prepare(`
      SELECT COALESCE(SUM(seconds_total), 0) AS total
      FROM analytics_voice_daily
      WHERE guild_id = ? AND day_key >= ?
    `)
    .get(guildId, fromDay)?.total || 0;

  const modActions = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM analytics_mod_actions
      WHERE guild_id = ? AND day_key >= ?
    `)
    .get(guildId, fromDay)?.total || 0;

  return {
    days,
    messages: Number(messages),
    reactions: Number(reactions),
    voiceSeconds: Number(voiceSeconds),
    moderationActions: Number(modActions),
  };
}

function getMessageTrend(guildId, days = 30) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  const rows = db
    .prepare(`
      SELECT day_key, message_count
      FROM analytics_daily_messages
      WHERE guild_id = ? AND day_key >= ?
      ORDER BY day_key ASC
    `)
    .all(guildId, fromDay);

  return fillSeries(rows, "day_key", "message_count", keys);
}

function getTopChannels(guildId, days = 30, limit = 8) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  return db
    .prepare(`
      SELECT channel_id, COALESCE(SUM(message_count), 0) AS total
      FROM analytics_channel_daily_messages
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY channel_id
      ORDER BY total DESC
      LIMIT ?
    `)
    .all(guildId, fromDay, limit)
    .map((row) => ({
      channelId: row.channel_id,
      total: Number(row.total),
    }));
}

function getTopUsers(guildId, days = 30, limit = 8) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  return db
    .prepare(`
      SELECT user_id, COALESCE(SUM(message_count), 0) AS total
      FROM analytics_user_daily_messages
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT ?
    `)
    .all(guildId, fromDay, limit)
    .map((row) => ({
      userId: row.user_id,
      total: Number(row.total),
    }));
}

function getTopCommands(guildId, days = 30, limit = 8) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  return db
    .prepare(`
      SELECT command_name, COALESCE(SUM(usage_count), 0) AS total
      FROM analytics_command_usage_daily
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY command_name
      ORDER BY total DESC
      LIMIT ?
    `)
    .all(guildId, fromDay, limit)
    .map((row) => ({
      commandName: row.command_name,
      total: Number(row.total),
    }));
}

function getCommandTrend(guildId, days = 30) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  const rows = db
    .prepare(`
      SELECT day_key, COALESCE(SUM(usage_count), 0) AS total
      FROM analytics_command_usage_daily
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY day_key
      ORDER BY day_key ASC
    `)
    .all(guildId, fromDay);

  return fillSeries(rows, "day_key", "total", keys);
}

function getModerationTrend(guildId, days = 30) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  const rows = db
    .prepare(`
      SELECT day_key, COUNT(*) AS total
      FROM analytics_mod_actions
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY day_key
      ORDER BY day_key ASC
    `)
    .all(guildId, fromDay);

  return fillSeries(rows, "day_key", "total", keys);
}

function getRecentModerationActions(guildId, limit = 10) {
  return db
    .prepare(`
      SELECT action_type, target_id, moderator_id, reason, created_at
      FROM analytics_mod_actions
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(guildId, limit)
    .map((row) => ({
      actionType: row.action_type,
      targetId: row.target_id,
      moderatorId: row.moderator_id,
      reason: row.reason,
      createdAt: Number(row.created_at),
    }));
}

function getVoiceLeaderboard(guildId, days = 30, limit = 8) {
  const keys = getDateKeysForDays(days);
  const fromDay = keys[0];

  return db
    .prepare(`
      SELECT user_id, COALESCE(SUM(seconds_total), 0) AS total
      FROM analytics_voice_daily
      WHERE guild_id = ? AND day_key >= ?
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT ?
    `)
    .all(guildId, fromDay, limit)
    .map((row) => ({
      userId: row.user_id,
      totalSeconds: Number(row.total),
    }));
}

module.exports = {
  ensureAnalyticsTables,
  recordMessage,
  recordReaction,
  recordCommandUse,
  startVoiceSession,
  endVoiceSession,
  moveVoiceSession,
  recordModerationAction,
  getAnalyticsSummary,
  getMessageTrend,
  getTopChannels,
  getTopUsers,
  getTopCommands,
  getCommandTrend,
  getModerationTrend,
  getRecentModerationActions,
  getVoiceLeaderboard,
};