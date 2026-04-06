const db = require("../../../database/db");

const upsertTempBanStmt = db.prepare(`
  INSERT INTO temp_bans (
    guild_id,
    user_id,
    moderator_id,
    reason,
    created_at,
    expires_at,
    active
  ) VALUES (?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    moderator_id = excluded.moderator_id,
    reason = excluded.reason,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    active = 1
`);

const deactivateTempBanStmt = db.prepare(`
  UPDATE temp_bans
  SET active = 0
  WHERE guild_id = ? AND user_id = ?
`);

const getActiveTempBanStmt = db.prepare(`
  SELECT *
  FROM temp_bans
  WHERE guild_id = ? AND user_id = ? AND active = 1
`);

const getAllActiveTempBansStmt = db.prepare(`
  SELECT *
  FROM temp_bans
  WHERE active = 1
  ORDER BY expires_at ASC
`);

const getExpiredTempBansStmt = db.prepare(`
  SELECT *
  FROM temp_bans
  WHERE active = 1 AND expires_at <= ?
  ORDER BY expires_at ASC
`);

function upsertTempBan({
  guildId,
  userId,
  moderatorId,
  reason = null,
  createdAt = Math.floor(Date.now() / 1000),
  expiresAt,
}) {
  upsertTempBanStmt.run(
    guildId,
    userId,
    moderatorId,
    reason,
    createdAt,
    expiresAt
  );

  return getActiveTempBanStmt.get(guildId, userId);
}

function deactivateTempBan(guildId, userId) {
  deactivateTempBanStmt.run(guildId, userId);
}

function getActiveTempBan(guildId, userId) {
  return getActiveTempBanStmt.get(guildId, userId) || null;
}

function getAllActiveTempBans() {
  return getAllActiveTempBansStmt.all();
}

function getExpiredTempBans(nowUnix = Math.floor(Date.now() / 1000)) {
  return getExpiredTempBansStmt.all(nowUnix);
}

module.exports = {
  upsertTempBan,
  deactivateTempBan,
  getActiveTempBan,
  getAllActiveTempBans,
  getExpiredTempBans,
};