const { PermissionFlagsBits } = require("discord.js");
const { getJailSettings, setJailChannel } = require("../../../helpers/database/jail");

module.exports = {
  name: "setjailchannel",
  description: "Set the jail channel and grant the jail role access to it.",
  aliases: ["jailchannel"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  adminOnly: true,

  options: [
    {
      name: "channel",
      type: "channel",
      description: "Channel to use as the jail channel",
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
      return ctx.reply("Give me a text channel for jail.");
    }

    const settings = getJailSettings(ctx.guild.id);
    if (!settings?.jail_role_id) {
      return ctx.reply("Set the jail role first with `setjailrole`.");
    }

    const jailRole = await ctx.guild.roles.fetch(settings.jail_role_id).catch(() => null);
    if (!jailRole) {
      return ctx.reply("The configured jail role could not be found. Set it again first.");
    }

    await channel.permissionOverwrites.edit(jailRole.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    await channel.permissionOverwrites.edit(ctx.guild.roles.everyone.id, {
      ViewChannel: false,
    });

    setJailChannel(ctx.guild.id, channel.id);

    return ctx.reply(`Alright. ${channel} is now the jail channel, and ${jailRole} can access it.`);
  },
};