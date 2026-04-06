const { EmbedBuilder } = require("discord.js");
const { getGuildCase } = require("../../../helpers/database/modCases");

function formatUnix(unix) {
  if (!unix) return "N/A";
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

module.exports = {
  name: "case",
  description: "View a moderation case by ID.",
  aliases: ["c"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "id",
      type: "integer",
      description: "Case ID",
      required: true,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let caseId;

    if (ctx.isSlash) {
      caseId = ctx.getInteger("id");
    } else {
      caseId = parseInt(ctx.args[0], 10);
    }

    if (!caseId || isNaN(caseId)) {
      return ctx.reply("Give me a valid case ID.");
    }

    const data = getGuildCase(ctx.guild.id, caseId);

    if (!data) {
      return ctx.reply(`I couldn't find case #${caseId}. Maybe it fell behind something.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Case #${data.case_id}`)
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Action",
          value: data.action_type,
          inline: true,
        },
        {
          name: "User",
          value: `<@${data.user_id}> (\`${data.user_id}\`)`,
          inline: true,
        },
        {
          name: "Moderator",
          value: `<@${data.moderator_id}> (\`${data.moderator_id}\`)`,
          inline: true,
        },
        {
          name: "Reason",
          value: data.reason || "No reason provided.",
          inline: false,
        },
        {
          name: "Created",
          value: formatUnix(data.created_at),
          inline: false,
        }
      );

    if (data.expires_at) {
      embed.addFields({
        name: "Expires",
        value: formatUnix(data.expires_at),
        inline: false,
      });
    }

    embed.addFields({
      name: "Status",
      value: data.active ? "Active" : "Inactive",
      inline: false,
    });

    return ctx.reply({ embeds: [embed] });
  },
};