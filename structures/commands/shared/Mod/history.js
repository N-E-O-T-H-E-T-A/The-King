const { EmbedBuilder } = require("discord.js");
const { getUserCases } = require("../../../helpers/database/modCases");

function formatCaseLine(c) {
  return `**#${c.case_id}** • ${c.action_type} • <t:${c.created_at}:R>`;
}

module.exports = {
  name: "history",
  description: "View moderation history for a user.",
  aliases: ["cases"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "user",
      type: "user",
      description: "User to view history for",
      required: true,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let targetUser;

    if (ctx.isSlash) {
      targetUser = ctx.getUser("user");
    } else {
      targetUser =
        ctx.source.mentions.users.first() ||
        (ctx.args[0] ? await ctx.client.users.fetch(ctx.args[0]).catch(() => null) : null);
    }

    if (!targetUser) {
      return ctx.reply("I need a user to look into.");
    }

    const cases = getUserCases(ctx.guild.id, targetUser.id, 10);

    if (!cases.length) {
      return ctx.reply("No cases found for that user. Suspiciously clean.");
    }

    const embed = new EmbedBuilder()
      .setTitle(`History • ${targetUser.tag}`)
      .setColor(0x5865f2)
      .setDescription(
        cases.map(formatCaseLine).join("\n")
      )
      .setFooter({ text: `Showing last ${cases.length} cases` });

    return ctx.reply({ embeds: [embed] });
  },
};