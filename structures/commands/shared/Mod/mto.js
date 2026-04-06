const { PermissionFlagsBits } = require("discord.js");
const parseDuration = require("../../../helpers/parseDuration");
const modResponse = require("../../../helpers/modResponses");
const { createCaseAndLog } = require("../../../helpers/modlog");

module.exports = {
  name: "mto",
  description: "Mass-timeout multiple users and role members at once.",
  aliases: ["mtimeout", "masstimeout"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "user1",
      type: "user",
      description: "First user to timeout",
      required: true,
    },
    {
      name: "duration",
      type: "string",
      description: "Duration like 10m, 1h, 2d",
      required: true,
    },
    {
      name: "user2",
      type: "user",
      description: "Second user to timeout",
      required: false,
    },
    {
      name: "user3",
      type: "user",
      description: "Third user to timeout",
      required: false,
    },
    {
      name: "user4",
      type: "user",
      description: "Fourth user to timeout",
      required: false,
    },
    {
      name: "user5",
      type: "user",
      description: "Fifth user to timeout",
      required: false,
    },
    {
      name: "role1",
      type: "role",
      description: "First role to include",
      required: false,
    },
    {
      name: "role2",
      type: "role",
      description: "Second role to include",
      required: false,
    },
    {
      name: "role3",
      type: "role",
      description: "Third role to include",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for the timeout",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply(modResponse("error", "notInGuild"));
    }

    let durationInput = null;
    let reason = "No reason was scribbled down.";
    const targetMap = new Map();

    if (ctx.isSlash) {
      const users = [
        ctx.getUser("user1"),
        ctx.getUser("user2"),
        ctx.getUser("user3"),
        ctx.getUser("user4"),
        ctx.getUser("user5"),
      ].filter(Boolean);

      const roles = [
        ctx.source.options.getRole("role1"),
        ctx.source.options.getRole("role2"),
        ctx.source.options.getRole("role3"),
      ].filter(Boolean);

      durationInput = ctx.getString("duration");
      reason = ctx.getString("reason", reason);

      for (const user of users) {
        targetMap.set(user.id, user);
      }

      for (const role of roles) {
        for (const [, member] of role.members) {
          targetMap.set(member.user.id, member.user);
        }
      }
    } else {
      const mentionedUsers = [...ctx.source.mentions.users.values()];
      const mentionedRoles = [...ctx.source.mentions.roles.values()];

      for (const user of mentionedUsers) {
        targetMap.set(user.id, user);
      }

      for (const role of mentionedRoles) {
        for (const [, member] of role.members) {
          targetMap.set(member.user.id, member.user);
        }
      }

      const rawArgs = ctx.args.filter(
        (arg) => !/^<@!?(\d+)>$/.test(arg) && !/^<@&(\d+)>$/.test(arg)
      );

      durationInput = rawArgs[0];
      reason = rawArgs.slice(1).join(" ") || reason;
    }

    const targets = [...targetMap.values()];

    if (!targets.length) {
      return ctx.reply("I need at least one user or role to put into the quiet boxes.");
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      return ctx.reply(modResponse("error", "invalidDuration"));
    }

    const expiresAt = Math.floor((Date.now() + durationMs) / 1000);

    const results = {
      success: [],
      failed: [],
    };

    for (const user of targets) {
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        results.failed.push(`${user.tag} — not in server`);
        continue;
      }

      if (!member.moderatable) {
        results.failed.push(`${user.tag} — not moderatable`);
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
        await member.timeout(durationMs, reason);
        results.success.push(user.tag);

        await createCaseAndLog(ctx.client, {
          guild: ctx.guild,
          targetUser: user,
          moderatorUser: ctx.user,
          actionType: "mto",
          reason,
          expiresAt,
          active: 1,
          metadata: {
            Duration: durationInput,
          },
        });
      } catch {
        results.failed.push(`${user.tag} — timeout failed`);
      }
    }

    if (!results.success.length && results.failed.length) {
      return ctx.reply(
        [
          "🪑 I couldn't get any of them into the quiet boxes.",
          "",
          `**Failed (${results.failed.length}):**`,
          results.failed.map((x) => `- ${x}`).join("\n"),
        ].join("\n")
      );
    }

    const lines = [
      `📦 I packed away **${results.success.length}** member(s) for \`${durationInput}\`.`,
      `**Reason:** ${reason}`,
    ];

    if (results.success.length) {
      lines.push("", `**Timed out:**`, results.success.map((x) => `- ${x}`).join("\n"));
    }

    if (results.failed.length) {
      lines.push("", `**Failed (${results.failed.length}):**`, results.failed.map((x) => `- ${x}`).join("\n"));
    }

    return ctx.reply(lines.join("\n"));
  },
};