const { PermissionFlagsBits } = require("discord.js");
const { setJailRole } = require("../../../helpers/database/jail");

module.exports = {
  name: "setjailrole",
  description: "Set the role used for jailed users.",
  aliases: ["jailrole"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  adminOnly: true,

  options: [
    {
      name: "role",
      type: "role",
      description: "Role to use as the jail role",
      required: true,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let role = null;

    if (ctx.isSlash) {
      role = ctx.source.options.getRole("role");
    } else {
      role = ctx.source.mentions.roles.first() || null;
    }

    if (!role) {
      return ctx.reply("Give me a role to use for jail.");
    }

    setJailRole(ctx.guild.id, role.id);
    return ctx.reply(`Alright. ${role} is now the jail role.`);
  },
};