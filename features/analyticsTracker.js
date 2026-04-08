const {
  recordMessage,
  recordReaction,
  startVoiceSession,
  endVoiceSession,
  moveVoiceSession,
} = require("../structures/helpers/database/analytics");

module.exports = function analyticsTracker(client) {
  client.on("messageCreate", (message) => {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;

      recordMessage({
        guildId: message.guild.id,
        channelId: message.channel.id,
        userId: message.author.id,
        createdAt: message.createdAt || new Date(),
      });
    } catch (error) {
      console.error("[ANALYTICS MESSAGE TRACK ERROR]", error);
    }
  });

  client.on("messageReactionAdd", (reaction, user) => {
    try {
      if (user?.bot) return;
      const guildId = reaction.message?.guild?.id;
      if (!guildId) return;

      recordReaction({
        guildId,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("[ANALYTICS REACTION TRACK ERROR]", error);
    }
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    try {
      const guildId = newState.guild?.id || oldState.guild?.id;
      const userId = newState.id || oldState.id;
      if (!guildId || !userId) return;

      const oldChannelId = oldState.channelId;
      const newChannelId = newState.channelId;

      if (!oldChannelId && newChannelId) {
        startVoiceSession({
          guildId,
          userId,
          channelId: newChannelId,
          joinedAt: Date.now(),
        });
        return;
      }

      if (oldChannelId && !newChannelId) {
        endVoiceSession({
          guildId,
          userId,
          endedAt: Date.now(),
        });
        return;
      }

      if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
        moveVoiceSession({
          guildId,
          userId,
          newChannelId,
          movedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error("[ANALYTICS VOICE TRACK ERROR]", error);
    }
  });

  console.log("[FEATURE] Analytics tracker ready");
};