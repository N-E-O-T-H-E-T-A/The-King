const { Events, EmbedBuilder } = require("discord.js");
const {
  getAfk,
  clearAfk,
  addAfkMention,
  getAfkMentions,
  clearAfkMentions,
} = require("../structures/helpers/database/afk");

function buildMessageUrl(message) {
  return `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
}

function previewText(text, max = 120) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function uniqueUsersById(users) {
  return [...new Map(users.map((u) => [u.id, u])).values()];
}

module.exports = function afkWatcher(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      
      const prefix = client.config?.prefix || "tk";


if (message.content.startsWith(`${prefix}afk`) || message.content.startsWith(`${prefix}away`)) {
  return;
}

      const guildId = message.guild.id;
      const authorId = message.author.id;

      // Return-from-AFK handling
      const authorAfk = getAfk(guildId, authorId);
      if (authorAfk) {
        const mentions = getAfkMentions(guildId, authorId);

        clearAfk(guildId, authorId);
        clearAfkMentions(guildId, authorId);

        const embed = new EmbedBuilder()
          .setTitle("Welcome back")
          .setColor(0x57f287)
          .setDescription(
            mentions.length
              ? `You were pinged **${mentions.length}** time(s) while you were away.`
              : `You were AFK, but nobody bothered you. Very peaceful.`
          );

        if (authorAfk.reason) {
          embed.addFields({
            name: "Previous AFK Reason",
            value: authorAfk.reason,
            inline: false,
          });
        }

        if (mentions.length) {
          const lines = mentions.slice(0, 10).map((row) => {
            const preview = row.message_preview?.trim()
              ? ` — ${row.message_preview}`
              : "";
            return `• <@${row.pinger_user_id}> • <t:${row.created_at}:R> • [jump](${row.message_url})${preview}`;
          });

          embed.addFields({
            name: `Recent pings (${Math.min(mentions.length, 10)} shown)`,
            value: lines.join("\n").slice(0, 1024),
            inline: false,
          });

          if (mentions.length > 10) {
            embed.setFooter({
              text: `${mentions.length - 10} more ping(s) were stored too.`,
            });
          }
        }

        await message.reply({
          embeds: [embed],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }

      // AFK mention tracking
      const mentionedUsers = [...message.mentions.users.values()];

      const repliedUser =
        message.reference?.messageId
          ? await message.channel.messages
              .fetch(message.reference.messageId)
              .then((msg) => msg.author)
              .catch(() => null)
          : null;

      const targets = uniqueUsersById(
        [
          ...mentionedUsers,
          ...(repliedUser ? [repliedUser] : []),
        ].filter(Boolean)
      ).filter((user) => user.id !== message.author.id);

      if (!targets.length) return;

      const afkTargets = [];

      for (const user of targets) {
        const afk = getAfk(guildId, user.id);
        if (!afk) continue;

        addAfkMention({
          guildId,
          afkUserId: user.id,
          pingerUserId: message.author.id,
          channelId: message.channel.id,
          messageId: message.id,
          messageUrl: buildMessageUrl(message),
          messagePreview: previewText(message.content || ""),
        });

        afkTargets.push({ user, afk });
      }

      if (!afkTargets.length) return;

      const lines = afkTargets.map(({ user, afk }) => {
        const since = `<t:${afk.since}:R>`;
        const reason = afk.reason ? ` — ${afk.reason}` : "";
        return `**${user.tag}** is AFK (${since})${reason}`;
      });

      await message.reply({
        content: lines.join("\n"),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    } catch (error) {
      console.error("[AFK WATCHER ERROR]", error);
    }
  });
};