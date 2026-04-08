const { getGuildSettings, setGuildPrefix } = require("../../../helpers/database/guildSettings");

module.exports = {
  name: "prefix",
  description: "View or change the guild prefix.",
  category: "util",
  prefix: true,
  slash: false,
  aliases: [],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This command can only be used in a server.");
    }

    const current = getGuildSettings(ctx.guild.id)?.prefix || ctx.client.config.prefix;

    if (!ctx.args.length) {
      return ctx.reply(`Current prefix: \`${current}\``);
    }

    const memberPerms = ctx.member?.permissions;
    if (!memberPerms || !memberPerms.has("Administrator")) {
      return ctx.reply("You need Administrator permission to change the prefix.");
    }

    const newPrefix = String(ctx.args[0] || "").trim();

    if (!newPrefix || newPrefix.length > 10) {
      return ctx.reply("Prefix must be between 1 and 10 characters.");
    }

    setGuildPrefix(ctx.guild.id, newPrefix);
    return ctx.reply(`Prefix updated to \`${newPrefix}\``);
  },
};