// commands/shared/ban.js
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "ban",
  description: "Ban a member from the server.",
  aliases: [],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: [
    {
      name: "user",
      type: "user",
      description: "User to ban",
      required: true,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for the ban",
      required: false,
    },
  ],

  async run(ctx) {
    return ctx.reply("Make sure to add the person you are trying to ban.");
  },
};