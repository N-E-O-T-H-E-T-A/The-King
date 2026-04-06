const { PermissionFlagsBits } = require("discord.js");
const { archivePurgedMessages } = require("../../../helpers/purgeArchive");
const { createCaseAndLog } = require("../../../helpers/modlog");

const MAX_PURGE = 100;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function normalize(text) {
  return (text || "").toLowerCase();
}

function parsePrefixPurgeArgs(ctx) {
  const args = [...ctx.args];
  let mode = "amount";
  let targetUser = null;
  let contains = null;
  let amount = null;
  let reason = "No reason was scribbled down.";

  const first = normalize(args[0]);

  if (first === "user") {
    mode = "user";
    targetUser =
      ctx.source.mentions.users.first() ||
      (args[1] ? null : null);

    amount = Number.parseInt(args[2], 10);
    reason = args.slice(3).join(" ").trim() || reason;

    return { mode, targetUser, contains, amount, reason };
  }

  if (first === "bots" || first === "bot") {
    mode = "bots";
    amount = Number.parseInt(args[1], 10);
    reason = args.slice(2).join(" ").trim() || reason;

    return { mode, targetUser, contains, amount, reason };
  }

  if (first === "contains" || first === "match" || first === "text") {
    mode = "contains";
    contains = args[1] || null;
    amount = Number.parseInt(args[2], 10);
    reason = args.slice(3).join(" ").trim() || reason;

    return { mode, targetUser, contains, amount, reason };
  }

  amount = Number.parseInt(args[0], 10);
  reason = args.slice(1).join(" ").trim() || reason;

  return { mode, targetUser, contains, amount, reason };
}

async function fetchCandidateMessages(channel, fetchLimit = 100) {
  const fetched = await channel.messages.fetch({ limit: fetchLimit }).catch(() => null);
  if (!fetched) return [];
  return [...fetched.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

function filterMessages(messages, sourceMessageId, mode, targetUser, contains) {
  let filtered = messages.filter((m) => m.id !== sourceMessageId);

  if (mode === "user" && targetUser) {
    filtered = filtered.filter((m) => m.author?.id === targetUser.id);
  }

  if (mode === "bots") {
    filtered = filtered.filter((m) => m.author?.bot);
  }

  if (mode === "contains" && contains) {
    const needle = normalize(contains);
    filtered = filtered.filter((m) => normalize(m.content).includes(needle));
  }

  return filtered;
}

module.exports = {
  name: "purge",
  description: "Delete recent messages with filters and archive them first.",
  aliases: ["clear", "clean"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ManageMessages,

  options: [
    {
      name: "amount",
      type: "integer",
      description: "How many recent messages to purge",
      required: true,
    },
    {
      name: "mode",
      type: "string",
      description: "Filter mode",
      required: false,
      choices: [
        { name: "amount", value: "amount" },
        { name: "user", value: "user" },
        { name: "bots", value: "bots" },
        { name: "contains", value: "contains" },
      ],
    },
    {
      name: "user",
      type: "user",
      description: "User filter for user mode",
      required: false,
    },
    {
      name: "contains",
      type: "string",
      description: "Text to match for contains mode",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for the purge",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    if (!ctx.channel?.isTextBased()) {
      return ctx.reply("This channel can't be purged like that.");
    }

    let amount;
    let mode = "amount";
    let targetUser = null;
    let contains = null;
    let reason = "No reason was scribbled down.";

    if (ctx.isSlash) {
      amount = ctx.getInteger("amount");
      mode = ctx.getString("mode", "amount");
      targetUser = ctx.getUser("user", null);
      contains = ctx.getString("contains", null);
      reason = ctx.getString("reason", reason);
    } else {
      const parsed = parsePrefixPurgeArgs(ctx);
      amount = parsed.amount;
      mode = parsed.mode;
      targetUser = parsed.targetUser;
      contains = parsed.contains;
      reason = parsed.reason;
    }

    if (!amount || Number.isNaN(amount)) {
      return ctx.reply("Give me a valid number of messages to purge.");
    }

    if (amount < 1 || amount > MAX_PURGE) {
      return ctx.reply(`Pick a number between 1 and ${MAX_PURGE}. Any more and the broom gets ideas.`);
    }

    if (mode === "user" && !targetUser) {
      return ctx.reply("For user purge mode, give me a user.");
    }

    if (mode === "contains" && !contains) {
      return ctx.reply("For contains purge mode, give me some text to match.");
    }

    const fetchedMessages = await fetchCandidateMessages(ctx.channel, 100);
    if (!fetchedMessages.length) {
      return ctx.reply("I couldn't fetch any messages to purge.");
    }

    const filtered = filterMessages(
      fetchedMessages,
      ctx.isPrefix ? ctx.source.id : null,
      mode,
      targetUser,
      contains
    );

    const selected = filtered.slice(0, amount);

    if (!selected.length) {
      return ctx.reply("There wasn't anything matching that purge filter.");
    }

    await archivePurgedMessages(ctx.client, {
      guild: ctx.guild,
      sourceChannel: ctx.channel,
      moderatorUser: ctx.user,
      messages: selected,
      reason,
    });

    const now = Date.now();
    const deletable = selected.filter((m) => now - m.createdTimestamp < FOURTEEN_DAYS_MS);
    const tooOld = selected.filter((m) => now - m.createdTimestamp >= FOURTEEN_DAYS_MS);

    let deletedCount = 0;

    if (deletable.length) {
      const deleted = await ctx.channel.bulkDelete(deletable, true).catch(() => null);
      deletedCount = deleted?.size || 0;
    }

    await createCaseAndLog(ctx.client, {
      guild: ctx.guild,
      targetUser: ctx.user,
      moderatorUser: ctx.user,
      actionType: "purge",
      reason,
      active: 0,
      metadata: {
        Channel: `${ctx.channel.name} (${ctx.channel.id})`,
        Mode: mode,
        AmountRequested: String(amount),
        Deleted: String(deletedCount),
        SkippedTooOld: String(tooOld.length),
        UserFilter: targetUser ? `${targetUser.tag} (${targetUser.id})` : null,
        Contains: contains || null,
      },
    });

    const replyText = [
      `🧹 Swept away **${deletedCount}** message(s).`,
      tooOld.length ? `⏳ Skipped **${tooOld.length}** message(s) older than 14 days.` : null,
      `📦 Archived purge transcript first.`,
      `**Mode:** ${mode}`,
      targetUser ? `**User Filter:** ${targetUser.tag}` : null,
      contains ? `**Contains:** \`${contains}\`` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (ctx.isSlash) {
      return ctx.reply({
        content: replyText,
        ephemeral: true,
      });
    }

    const sent = await ctx.channel
      .send({
        content: replyText,
        allowedMentions: { parse: [] },
      })
      .catch(() => null);

    if (sent) {
      setTimeout(() => sent.delete().catch(() => {}), 5000);
    }
  },
};