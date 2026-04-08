const { EmbedBuilder } = require("discord.js");
const { setAfk, getAfk } = require("../../../helpers/database/afk");

module.exports = {
  name: "afk",
  description: "Set yourself as AFK with an optional reason.",
  aliases: ["away"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "reason",
      type: "string",
      description: "Optional AFK reason",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let reason = null;

    if (ctx.isSlash) {
      reason = ctx.getString("reason", null);
    } else {
      reason = ctx.args.join(" ").trim() || null;
    }

    const existing = getAfk(ctx.guild.id, ctx.user.id);
    const record = setAfk(ctx.guild.id, ctx.user.id, reason);

    const embed = new EmbedBuilder()
      .setTitle(existing ? "AFK Updated" : "AFK Enabled")
      .setColor(0x5865f2)
      .setDescription(
        existing
          ? "Your AFK status has been updated."
          : "You are now marked as AFK."
      )
      .addFields(
        {
          name: "Since",
          value: `<t:${record.since}:f> (<t:${record.since}:R>)`,
          inline: false,
        },
        {
          name: "Reason",
          value: reason || "No reason provided.",
          inline: false,
        }
      );

    return ctx.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  },
};