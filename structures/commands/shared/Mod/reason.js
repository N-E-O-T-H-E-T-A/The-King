const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getGuildCase, updateCaseReason } = require("../../../helpers/database/modCases");

function formatUnix(unix) {
  if (!unix) return "N/A";
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

module.exports = {
  name: "reason",
  description: "Edit the reason for a moderation case.",
  aliases: ["caseedit", "editreason"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "id",
      type: "integer",
      description: "Case ID to edit",
      required: true,
    },
    {
      name: "reason",
      type: "string",
      description: "New reason for the case",
      required: true,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let caseId;
    let newReason;

    if (ctx.isSlash) {
      caseId = ctx.getInteger("id");
      newReason = ctx.getString("reason");
    } else {
      caseId = Number.parseInt(ctx.args[0], 10);
      newReason = ctx.args.slice(1).join(" ").trim();
    }

    if (!caseId || Number.isNaN(caseId)) {
      return ctx.reply("Give me a valid case ID.");
    }

    if (!newReason) {
      return ctx.reply("I need a new reason to scribble onto the case.");
    }

    const existing = getGuildCase(ctx.guild.id, caseId);
    if (!existing) {
      return ctx.reply(`I couldn't find case #${caseId}. It may have slipped under a cabinet.`);
    }

    const updated = updateCaseReason(ctx.guild.id, caseId, newReason);

    const embed = new EmbedBuilder()
      .setTitle(`Case #${updated.case_id} • Reason Updated`)
      .setColor(0x57f287)
      .addFields(
        {
          name: "Action",
          value: updated.action_type,
          inline: true,
        },
        {
          name: "User",
          value: `<@${updated.user_id}> (\`${updated.user_id}\`)`,
          inline: true,
        },
        {
          name: "Moderator",
          value: `<@${updated.moderator_id}> (\`${updated.moderator_id}\`)`,
          inline: true,
        },
        {
          name: "New Reason",
          value: updated.reason || "No reason provided.",
          inline: false,
        },
        {
          name: "Created",
          value: formatUnix(updated.created_at),
          inline: false,
        }
      );

    if (updated.expires_at) {
      embed.addFields({
        name: "Expires",
        value: formatUnix(updated.expires_at),
        inline: false,
      });
    }

    embed.addFields({
      name: "Status",
      value: updated.active ? "Active" : "Inactive",
      inline: false,
    });

    return ctx.reply({ embeds: [embed] });
  },
};