const { PermissionFlagsBits } = require("discord.js");
const modResponse = require("../../../helpers/modResponses");

module.exports = {
  name: "untimeout",
  description: "Remove a timeout from a member, or from everyone currently timed out.",
  aliases: ["uto", "unmute"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "user",
      type: "user",
      description: "The user to untimeout",
      required: false,
    },
    {
      name: "all",
      type: "boolean",
      description: "Remove timeout from all timed out members",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for removing the timeout",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply(modResponse("error", "notInGuild"));
    }

    let reason = "No reason was scribbled down.";

    if (ctx.isSlash) {
      const all = ctx.getBoolean("all", false);
      const user = ctx.getUser("user");
      reason = ctx.getString("reason", reason);

      if (all) {
        const members = await ctx.guild.members.fetch();
        const timedOut = members.filter(
          (member) =>
            member.communicationDisabledUntilTimestamp &&
            member.communicationDisabledUntilTimestamp > Date.now()
        );

        if (!timedOut.size) {
          return ctx.reply(modResponse("error", "nothingTimedOut"));
        }

        let count = 0;
        for (const [, member] of timedOut) {
          if (!member.moderatable) continue;
          await member.timeout(null, reason).catch(() => null);
          count++;
        }

        return ctx.reply(modResponse("success", "untimeoutAll", { count }));
      }

      if (!user) {
        return ctx.reply(modResponse("error", "missingUserOrAll"));
      }

      const member = await ctx.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return ctx.reply(modResponse("error", "memberNotFound"));
      }

      await member.timeout(null, reason).catch(() => null);
      return ctx.reply(modResponse("success", "untimeout", { userTag: user.tag }));
    }

    const firstArg = ctx.args[0]?.toLowerCase();

    if (firstArg === "all") {
      reason = ctx.args.slice(1).join(" ") || reason;

      const members = await ctx.guild.members.fetch();
      const timedOut = members.filter(
        (member) =>
          member.communicationDisabledUntilTimestamp &&
          member.communicationDisabledUntilTimestamp > Date.now()
      );

      if (!timedOut.size) {
        return ctx.reply(modResponse("error", "nothingTimedOut"));
      }

      let count = 0;
      for (const [, member] of timedOut) {
        if (!member.moderatable) continue;
        await member.timeout(null, reason).catch(() => null);
        count++;
      }

      return ctx.reply(modResponse("success", "untimeoutAll", { count }));
    }

    const targetUser =
      ctx.source.mentions.users.first() ||
      (ctx.args[0] ? await ctx.client.users.fetch(ctx.args[0]).catch(() => null) : null);

    reason = ctx.args.slice(1).join(" ") || reason;

    if (!targetUser) {
      return ctx.reply(modResponse("error", "missingUserOrAll"));
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return ctx.reply(modResponse("error", "memberNotFound"));
    }

    await member.timeout(null, reason).catch(() => null);
    return ctx.reply(modResponse("success", "untimeout", { userTag: targetUser.tag }));
  },
};