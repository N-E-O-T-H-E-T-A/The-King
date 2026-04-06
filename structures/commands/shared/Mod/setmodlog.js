const { PermissionFlagsBits } = require("discord.js");
const { setModLogChannel } = require("../../../helpers/database/guildSettings");

module.exports = {
  name: "setmodlog",
  description: "Set the moderation log channel.",
  aliases: ["modlog", "setlog"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,

  options: [
    {
      name: "channel",
      type: "channel",
      description: "Channel to use for moderation logs",
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

    setModLogChannel(ctx.guild.id, channel.id);

    return ctx.reply(`Alright. I'll scribble moderation logs into ${channel}.`);
  },
};