const { PermissionFlagsBits } = require("discord.js");
const parseDuration = require("../../../helpers/parseDuration");
const modResponse = require("../../../helpers/modResponses");
const { createPersistentTempBan } = require("../../../helpers/tempBanScheduler");
const { createCaseAndLog } = require("../../../helpers/modlog");

const MAX_TARGETS = 25;

module.exports = {
  name: "mban",
  description: "Mass-ban multiple users and role members at once.",
  aliases: ["massban"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,

  options: [
    {
      name: "user1",
      type: "user",
      description: "First user to ban",
      required: false,
    },
    {
      name: "user2",
      type: "user",
      description: "Second user to ban",
      required: false,
    },
    {
      name: "user3",
      type: "user",
      description: "Third user to ban",
      required: false,
    },
    {
      name: "user4",
      type: "user",
      description: "Fourth user to ban",
      required: false,
    },
    {
      name: "user5",
      type: "user",
      description: "Fifth user to ban",
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
      name: "duration",
      type: "string",
      description: "Optional duration like 5h, 7d, 30m",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for the ban",
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

      durationInput = ctx.getString("duration", null);
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

      const maybeDuration = rawArgs[0] || null;
      const parsedMaybeDuration = maybeDuration ? parseDuration(maybeDuration) : null;

      if (parsedMaybeDuration) {
        durationInput = maybeDuration;
        reason = rawArgs.slice(1).join(" ") || reason;
      } else {
        reason = rawArgs.join(" ") || reason;
      }
    }

    const targets = [...targetMap.values()];

    if (!targets.length) {
      return ctx.reply("I need at least one user or role to ban, or else I'm just pointing at wallpaper.");
    }

    if (targets.length > MAX_TARGETS) {
      return ctx.reply(
        `That's **${targets.length}** targets, which is too many for one frightened sweep. Keep it to **${MAX_TARGETS}** or fewer.`
      );
    }

    let durationMs = null;
    let expiresAt = null;

    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (!durationMs) {
        return ctx.reply(modResponse("error", "invalidDuration"));
      }

      expiresAt = Math.floor((Date.now() + durationMs) / 1000);
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const user of targets) {
      const existingBan = await ctx.guild.bans.fetch(user.id).catch(() => null);
      if (existingBan) {
        results.failed.push(`${user.tag} — already banned`);
        continue;
      }

      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        if (!member.bannable) {
          results.failed.push(`${user.tag} — not bannable`);
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

        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
          results.failed.push(`${user.tag} — admin skipped`);
          continue;
        }
      }

      try {
        await ctx.guild.members.ban(user.id, { reason });
        results.success.push(user.tag);

        if (durationMs) {
          createPersistentTempBan(ctx.client, {
            guildId: ctx.guild.id,
            userId: user.id,
            moderatorId: ctx.user.id,
            reason,
            durationMs,
          });

          await createCaseAndLog(ctx.client, {
            guild: ctx.guild,
            targetUser: user,
            moderatorUser: ctx.user,
            actionType: "tempban",
            reason,
            expiresAt,
            active: 1,
            metadata: {
              Duration: durationInput,
              Source: "mban",
            },
          });
        } else {
          await createCaseAndLog(ctx.client, {
            guild: ctx.guild,
            targetUser: user,
            moderatorUser: ctx.user,
            actionType: "mban",
            reason,
            active: 1,
          });
        }
      } catch {
        results.failed.push(`${user.tag} — ban failed`);
      }
    }

    if (!results.success.length) {
      return ctx.reply(
        [
          "🔨 I couldn't throw any of them out. The door won this round.",
          "",
          `**Failed (${results.failed.length}):**`,
          results.failed.map((x) => `- ${x}`).join("\n"),
        ].join("\n")
      );
    }

    const lines = [
      durationMs
        ? `⏳ I sent away **${results.success.length}** member(s) for \`${durationInput}\`.`
        : `🔨 I sent away **${results.success.length}** member(s).`,
      `**Reason:** ${reason}`,
    ];

    if (results.success.length) {
      lines.push(
        "",
        durationMs ? "**Temporarily banned:**" : "**Banned:**",
        results.success.map((x) => `- ${x}`).join("\n")
      );
    }

    if (results.failed.length) {
      lines.push(
        "",
        `**Failed (${results.failed.length}):**`,
        results.failed.map((x) => `- ${x}`).join("\n")
      );
    }

    return ctx.reply(lines.join("\n"));
  },
};