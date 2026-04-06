const { EmbedBuilder } = require("discord.js");
const { getGuildSettings } = require("./database/guildSettings");
const { createModCase } = require("./database/modCases");

function formatUnix(unix) {
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

function makeColor(actionType) {
  switch (actionType) {
    case "ban":
    case "mban":
      return 0xff4d4f;
    case "tempban":
      return 0xff7a45;
    case "timeout":
    case "mto":
      return 0xfaad14;
    case "untimeout":
    case "untimeout_all":
      return 0x52c41a;
    case "unban":
      return 0x40a9ff;
    case "kick":
      return 0xff7875;
    case "purge":
     return 0x9b59b6;
    default:
      return 0x7f8c8d;
  }
}

async function createCaseAndLog(client, {
  guild,
  targetUser,
  moderatorUser,
  actionType,
  reason = "No reason was scribbled down.",
  expiresAt = null,
  active = 1,
  metadata = {},
}) {
  const createdAt = Math.floor(Date.now() / 1000);

  const modCase = createModCase({
    guildId: guild.id,
    userId: targetUser.id,
    moderatorId: moderatorUser.id,
    actionType,
    reason,
    createdAt,
    expiresAt,
    active,
  });

  const settings = getGuildSettings(guild.id);
  if (!settings?.mod_log_channel_id) {
    return modCase;
  }

  const channel = await guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    return modCase;
  }

  const embed = new EmbedBuilder()
    .setColor(makeColor(actionType))
    .setTitle(`Case #${modCase.case_id} • ${actionType}`)
    .addFields(
      {
        name: "User",
        value: `${targetUser.tag} (\`${targetUser.id}\`)`,
        inline: false,
      },
      {
        name: "Moderator",
        value: `${moderatorUser.tag} (\`${moderatorUser.id}\`)`,
        inline: false,
      },
      {
        name: "Reason",
        value: reason || "No reason provided.",
        inline: false,
      },
      {
        name: "Created",
        value: formatUnix(createdAt),
        inline: false,
      }
    )
    .setTimestamp(new Date(createdAt * 1000));

  if (expiresAt) {
    embed.addFields({
      name: "Expires",
      value: formatUnix(expiresAt),
      inline: false,
    });
  }

  if (metadata && Object.keys(metadata).length) {
    const extraLines = [];

    for (const [key, value] of Object.entries(metadata)) {
      if (value == null || value === "") continue;
      extraLines.push(`**${key}:** ${value}`);
    }

    if (extraLines.length) {
      embed.addFields({
        name: "Extra",
        value: extraLines.join("\n").slice(0, 1024),
        inline: false,
      });
    }
  }

  await channel.send({ embeds: [embed] }).catch(() => null);

  return modCase;
}

module.exports = {
  createCaseAndLog,
};