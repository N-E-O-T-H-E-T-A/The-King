const { PermissionFlagsBits } = require("discord.js");
const parseDuration = require("../../../helpers/parseDuration");
const modResponse = require("../../../helpers/modResponses");
const { createCaseAndLog } = require("../../../helpers/modlog");

module.exports = {
  name: "timeout",
  description: "Timeout a member for a set duration.",
  aliases: ["to", "mute"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "user",
      type: "user",
      description: "The user to timeout",
      required: true,
    },
    {
      name: "duration",
      type: "string",
      description: "Duration like 10m, 1h, 2d",
      required: true,
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

    let targetUser = null;
    let durationInput = null;
    let reason = null;

    if (ctx.isSlash) {
      targetUser = ctx.getUser("user");
      durationInput = ctx.getString("duration");
      reason = ctx.getString("reason", "No reason was scribbled down.");
    } else {
      targetUser =
        ctx.source.mentions.users.first() ||
        (ctx.args[0] ? await ctx.client.users.fetch(ctx.args[0]).catch(() => null) : null);

      durationInput = ctx.args[1];
      reason = ctx.args.slice(2).join(" ") || "No reason was scribbled down.";
    }

    if (!targetUser) {
      return ctx.reply(modResponse("error", "userNotFound"));
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      return ctx.reply(modResponse("error", "invalidDuration"));
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return ctx.reply(modResponse("error", "memberNotFound"));
    }

    if (!member.moderatable) {
      return ctx.reply(modResponse("error", "notModeratable"));
    }

    if (
      ctx.member &&
      member.roles.highest.position >= ctx.member.roles.highest.position &&
      ctx.guild.ownerId !== ctx.member.id
    ) {
      return ctx.reply(modResponse("error", "hierarchy"));
    }

    await member.timeout(durationMs, reason);

    const expiresAt = Math.floor((Date.now() + durationMs) / 1000);

    await createCaseAndLog(ctx.client, {
      guild: ctx.guild,
      targetUser,
      moderatorUser: ctx.user,
      actionType: "timeout",
      reason,
      expiresAt,
      active: 1,
      metadata: {
        Duration: durationInput,
      },
    });

    return ctx.reply(
      modResponse("success", "timeout", {
        userTag: targetUser.tag,
        duration: durationInput,
        reason,
      })
    );
  },
};