const { PermissionFlagsBits } = require("discord.js");
const { unjailMember } = require("../../../helpers/jailManager");
const { createCaseAndLog } = require("../../../helpers/modlog");

module.exports = {
  name: "unjail",
  description: "Unjail one or more users and restore their original roles.",
  aliases: ["uj"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "user1",
      type: "user",
      description: "First user to unjail",
      required: false,
    },
    {
      name: "user2",
      type: "user",
      description: "Second user to unjail",
      required: false,
    },
    {
      name: "user3",
      type: "user",
      description: "Third user to unjail",
      required: false,
    },
    {
      name: "user4",
      type: "user",
      description: "Fourth user to unjail",
      required: false,
    },
    {
      name: "user5",
      type: "user",
      description: "Fifth user to unjail",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for unjailing",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let reason = "No reason was scribbled down.";
    let users = [];

    if (ctx.isSlash) {
      users = [
        ctx.getUser("user1"),
        ctx.getUser("user2"),
        ctx.getUser("user3"),
        ctx.getUser("user4"),
        ctx.getUser("user5"),
      ].filter(Boolean);

      reason = ctx.getString("reason", reason);
    } else {
      users = [...ctx.source.mentions.users.values()];
      reason = ctx.args.filter((arg) => !/^<@!?(\d+)>$/.test(arg)).join(" ").trim() || reason;
    }

    const uniqueUsers = [...new Map(users.map((u) => [u.id, u])).values()];

    if (!uniqueUsers.length) {
      return ctx.reply("I need at least one user to unjail.");
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const user of uniqueUsers) {
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        results.failed.push(`${user.tag} — not in server`);
        continue;
      }

      try {
        await unjailMember(member, reason);

        await createCaseAndLog(ctx.client, {
          guild: ctx.guild,
          targetUser: user,
          moderatorUser: ctx.user,
          actionType: "unjail",
          reason,
          active: 0,
        });

        results.success.push(user.tag);
      } catch (error) {
        results.failed.push(`${user.tag} — ${error.message}`);
      }
    }

    const lines = [];

    if (results.success.length) {
      lines.push(`🔓 Unjailed **${results.success.length}** member(s).`);
      lines.push(`**Unjailed:**`);
      lines.push(results.success.map((x) => `- ${x}`).join("\n"));
    }

    if (results.failed.length) {
      lines.push("");
      lines.push(`**Failed (${results.failed.length}):**`);
      lines.push(results.failed.map((x) => `- ${x}`).join("\n"));
    }

    return ctx.reply(lines.join("\n"));
  },
};