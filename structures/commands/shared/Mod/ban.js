const { PermissionFlagsBits } = require("discord.js");
const parseDuration = require("../../../helpers/parseDuration");
const modResponse = require("../../../helpers/modResponses");
const { scheduleTempUnban } = require("../../../helpers/tempBanScheduler");

module.exports = {
  name: "ban",
  description: "Ban a member permanently or for a set duration.",
  aliases: ["b"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,

  options: [
    {
      name: "user",
      type: "user",
      description: "The user to ban",
      required: true,
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

    let targetUser = null;
    let durationInput = null;
    let reason = "No reason was scribbled down.";

    if (ctx.isSlash) {
      targetUser = ctx.getUser("user");
      durationInput = ctx.getString("duration", null);
      reason = ctx.getString("reason", reason);
    } else {
      targetUser =
        ctx.source.mentions.users.first() ||
        (ctx.args[0] ? await ctx.client.users.fetch(ctx.args[0]).catch(() => null) : null);

      if (!targetUser) {
        return ctx.reply(modResponse("error", "userNotFound"));
      }

      // Prefix formats:
      // ,ban @user
      // ,ban @user reason here
      // ,ban @user 5h
      // ,ban @user 7d raid spam
      const maybeDuration = ctx.args[1] || null;
      const parsedMaybeDuration = maybeDuration ? parseDuration(maybeDuration) : null;

      if (parsedMaybeDuration) {
        durationInput = maybeDuration;
        reason = ctx.args.slice(2).join(" ") || reason;
      } else {
        reason = ctx.args.slice(1).join(" ") || reason;
      }
    }

    if (!targetUser) {
      return ctx.reply(modResponse("error", "userNotFound"));
    }

    const existingBan = await ctx.guild.bans.fetch(targetUser.id).catch(() => null);
    if (existingBan) {
      return ctx.reply(modResponse("error", "alreadyBanned"));
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
      if (!member.bannable) {
        return ctx.reply(modResponse("error", "cannotBan"));
      }

      if (
        ctx.member &&
        member.roles.highest.position >= ctx.member.roles.highest.position &&
        ctx.guild.ownerId !== ctx.member.id
      ) {
        return ctx.reply(modResponse("error", "hierarchy"));
      }
    }

    if (durationInput) {
      const durationMs = parseDuration(durationInput);
      if (!durationMs) {
        return ctx.reply(modResponse("error", "invalidDuration"));
      }

      await ctx.guild.members.ban(targetUser.id, { reason });
      scheduleTempUnban(
        ctx.client,
        ctx.guild.id,
        targetUser.id,
        durationMs,
        `Temporary ban expired: ${reason}`
      );

      return ctx.reply(
        modResponse("success", "tempban", {
          userTag: targetUser.tag,
          duration: durationInput,
          reason,
        })
      );
    }

    await ctx.guild.members.ban(targetUser.id, { reason });

    return ctx.reply(
      modResponse("success", "ban", {
        userTag: targetUser.tag,
        reason,
      })
    );
  },
};