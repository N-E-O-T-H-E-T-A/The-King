const { PermissionFlagsBits } = require("discord.js");
const {
  addBlockedWord,
  removeBlockedWord,
  getBlockedWords,
} = require("../../../helpers/database/blockedWords");

function parseQuotedArgs(input) {
  const matches = input.match(/"([^"]+)"|'([^']+)'|\S+/g) || [];
  return matches.map((token) => stripWrappingQuotes(token));
}

function stripWrappingQuotes(value) {
  const text = String(value || "").trim();

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).trim();
  }

  return text;
}

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
      description: "Word or phrase to add or remove",
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
      word = stripWrappingQuotes(ctx.getString("word", null));
    } else {
      const parsed = parseQuotedArgs(ctx.args.join(" "));
      mode = String(parsed[0] || "list").toLowerCase();
      word = stripWrappingQuotes(parsed.slice(1).join(" ")) || null;
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
      return ctx.reply("Provide a word or phrase.");
    }

    if (mode === "add") {
      const added = addBlockedWord(ctx.guild.id, word);

      if (!added) {
        return ctx.reply("That word or phrase is invalid.");
      }

      return ctx.reply(`Added blocked word/phrase: \`${added}\``);
    }

    if (mode === "remove") {
      const removed = removeBlockedWord(ctx.guild.id, word);

      if (!removed) {
        return ctx.reply("That word or phrase was not found.");
      }

      return ctx.reply(`Removed blocked word/phrase: \`${word.toLowerCase()}\``);
    }

    return ctx.reply("Mode must be `add`, `remove`, or `list`.");
  },
};