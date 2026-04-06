const {
  upsertTempBan,
  deactivateTempBan,
  getAllActiveTempBans,
  getExpiredTempBans,
} = require("./database/tempBans");

const activeTimers = new Map();

function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function unbanAndDeactivate(client, guildId, userId, reason = "Temporary ban expired") {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.unban(userId, reason).catch(() => null);
  } catch (error) {
    console.error(`[TEMPBAN] Failed to unban ${userId} in guild ${guildId}`, error);
  } finally {
    deactivateTempBan(guildId, userId);
    clearScheduledTempBan(guildId, userId);
  }
}

function clearScheduledTempBan(guildId, userId) {
  const key = makeKey(guildId, userId);

  if (activeTimers.has(key)) {
    clearTimeout(activeTimers.get(key));
    activeTimers.delete(key);
  }
}

function scheduleTempBanExpiry(client, record) {
  const key = makeKey(record.guild_id, record.user_id);

  clearScheduledTempBan(record.guild_id, record.user_id);

  const nowMs = Date.now();
  const expiresAtMs = record.expires_at * 1000;
  const delay = Math.max(0, expiresAtMs - nowMs);

  const timer = setTimeout(async () => {
    await unbanAndDeactivate(
      client,
      record.guild_id,
      record.user_id,
      `Temporary ban expired: ${record.reason || "No reason provided"}`
    );
  }, delay);

  activeTimers.set(key, timer);
}

function createPersistentTempBan(client, { guildId, userId, moderatorId, reason = null, durationMs }) {
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor((Date.now() + durationMs) / 1000);

  const record = upsertTempBan({
    guildId,
    userId,
    moderatorId,
    reason,
    createdAt,
    expiresAt,
  });

  scheduleTempBanExpiry(client, record);
  return record;
}

async function restoreTempBans(client) {
  const nowUnix = Math.floor(Date.now() / 1000);

  const expired = getExpiredTempBans(nowUnix);
  for (const record of expired) {
    await unbanAndDeactivate(
      client,
      record.guild_id,
      record.user_id,
      `Temporary ban expired while bot was offline: ${record.reason || "No reason provided"}`
    );
  }

  const active = getAllActiveTempBans();
  for (const record of active) {
    if (record.expires_at <= nowUnix) continue;
    scheduleTempBanExpiry(client, record);
  }

  console.log(`✅ Restored ${active.filter((r) => r.expires_at > nowUnix).length} active temp ban timer(s)`);
}

module.exports = {
  createPersistentTempBan,
  restoreTempBans,
  clearScheduledTempBan,
};