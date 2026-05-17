const { PermissionFlagsBits } = require("discord.js");
const {
  addBlockedWord,
  removeBlockedWord,
  getBlockedWords,
} = require("../../../helpers/database/blockedWords");

module.exports = {
  name: "filterword",
  description: "Add, remove, or list mirrored filter words.",
  aliases: ["slurfilter", "mirrorfilter"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  options: [
    {
      name: "mode",
      type: "string",
      description: "add, remove, or list",
      required: true,
      choices: [
        { name: "add", value: "add" },
        { name: "remove", value: "remove" },
        { name: "list", value: "list" },
      ],
    },
    {
      name: "word",
      type: "string",
      description: "Word to add or remove",
      required: false,
    },
  ],
  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This command only works in a server.");
    }

    let mode;
    let word;

    if (ctx.isSlash) {
      mode = String(ctx.getString("mode") || "").toLowerCase();
      word = ctx.getString("word", null);
    } else {
      mode = String(ctx.args[0] || "list").toLowerCase();
      word = ctx.args[1] || null;
    }

    if (mode === "list") {
      const words = getBlockedWords(ctx.guild.id);

      if (!words.length) {
        return ctx.reply("No blocked words are configured.");
      }

      return ctx.reply(
        `Blocked words:\n${words.map((entry) => `- ${entry}`).join("\n")}`
      );
    }

    if (!word) {
      return ctx.reply("Provide a word.");
    }

    if (mode === "add") {
      const added = addBlockedWord(ctx.guild.id, word);

      if (!added) {
        return ctx.reply("That word is invalid.");
      }

      return ctx.reply(`Added blocked word: \`${added}\``);
    }

    if (mode === "remove") {
      const removed = removeBlockedWord(ctx.guild.id, word);

      if (!removed) {
        return ctx.reply("That word was not found.");
      }

      return ctx.reply(`Removed blocked word: \`${String(word).toLowerCase()}\``);
    }

    return ctx.reply("Mode must be `add`, `remove`, or `list`.");
  },
};