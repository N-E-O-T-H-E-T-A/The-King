const { PermissionFlagsBits } = require("discord.js");
const { jailMember } = require("../../../helpers/jailManager");
const { createCaseAndLog } = require("../../../helpers/modLog");

module.exports = {
  name: "jail",
  description: "Jail one or more users by stripping roles and applying the jail role.",
  aliases: ["j"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "user1",
      type: "user",
      description: "First user to jail",
      required: true,
    },
    {
      name: "user2",
      type: "user",
      description: "Second user to jail",
      required: false,
    },
    {
      name: "user3",
      type: "user",
      description: "Third user to jail",
      required: false,
    },
    {
      name: "user4",
      type: "user",
      description: "Fourth user to jail",
      required: false,
    },
    {
      name: "user5",
      type: "user",
      description: "Fifth user to jail",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for jailing",
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
      return ctx.reply("I need at least one user to jail.");
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

      if (
        ctx.member &&
        member.roles.highest.position >= ctx.member.roles.highest.position &&
        ctx.guild.ownerId !== ctx.member.id
      ) {
        results.failed.push(`${user.tag} — hierarchy blocked`);
        continue;
      }

      try {
        await jailMember(member, ctx.user, reason);

        await createCaseAndLog(ctx.client, {
          guild: ctx.guild,
          targetUser: user,
          moderatorUser: ctx.user,
          actionType: "jail",
          reason,
          active: 1,
        });

        results.success.push(user.tag);
      } catch (error) {
        results.failed.push(`${user.tag} — ${error.message}`);
      }
    }

    const lines = [];

    if (results.success.length) {
      lines.push(`🔒 Jailed **${results.success.length}** member(s).`);
      lines.push(`**Jailed:**`);
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