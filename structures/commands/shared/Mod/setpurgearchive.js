const { PermissionFlagsBits } = require("discord.js");
const { setPurgeArchiveChannel } = require("../../../helpers/database/guildSettings");

module.exports = {
  name: "setpurgearchive",
  description: "Set the channel where purged messages are archived.",
  aliases: ["purgearchive", "setpurgechannel"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,

  options: [
    {
      name: "channel",
      type: "channel",
      description: "Channel to archive purged messages into",
      required: true,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let channel = null;

    if (ctx.isSlash) {
      channel = ctx.source.options.getChannel("channel");
    } else {
      channel = ctx.source.mentions.channels.first() || null;
    }

    if (!channel || !channel.isTextBased()) {
      return ctx.reply("Please give me a text channel.");
    }

    setPurgeArchiveChannel(ctx.guild.id, channel.id);

    return ctx.reply(`Alright. I'll stash purged messages in ${channel}.`);
  },
};