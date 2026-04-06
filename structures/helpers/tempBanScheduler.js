const scheduledUnbans = new Map();

function scheduleTempUnban(client, guildId, userId, durationMs, reason = "Temporary ban expired") {
  const key = `${guildId}:${userId}`;

  if (scheduledUnbans.has(key)) {
    clearTimeout(scheduledUnbans.get(key));
  }

  const timer = setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      await guild.members.unban(userId, reason);
    } catch (error) {
      console.error(`[TEMPBAN] Failed to unban ${userId} in guild ${guildId}:`, error);
    } finally {
      scheduledUnbans.delete(key);
    }
  }, durationMs);

  scheduledUnbans.set(key, timer);
}

module.exports = { scheduleTempUnban };