const { PermissionFlagsBits } = require("discord.js");
const { getAllJailedUsers, unjailMember } = require("../../../helpers/jailManager");
const { createCaseAndLog } = require("../../../helpers/modlog");

module.exports = {
  name: "unjailall",
  description: "Unjail everyone currently jailed.",
  aliases: ["uja", "clearjail"],
  slash: true,
  prefix: true,
  dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  options: [
    {
      name: "reason",
      type: "string",
      description: "Reason for unjailing everyone",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    const reason = ctx.isSlash
      ? ctx.getString("reason", "No reason was scribbled down.")
      : ctx.args.join(" ").trim() || "No reason was scribbled down.";

    const jailed = getAllJailedUsers(ctx.guild.id);

    if (!jailed.length) {
      return ctx.reply("Nobody is jailed right now.");
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const record of jailed) {
      const member = await ctx.guild.members.fetch(record.user_id).catch(() => null);

      if (!member) {
        results.failed.push(`${record.user_id} — not in server`);
        continue;
      }

      try {
        await unjailMember(member, reason);

        await createCaseAndLog(ctx.client, {
          guild: ctx.guild,
          targetUser: member.user,
          moderatorUser: ctx.user,
          actionType: "unjail",
          reason,
          active: 0,
          metadata: {
            Source: "unjailall",
          },
        });

        results.success.push(member.user.tag);
      } catch (error) {
        results.failed.push(`${member.user.tag} — ${error.message}`);
      }
    }

    const lines = [];

    if (results.success.length) {
      lines.push(`🔓 Unjailed **${results.success.length}** member(s).`);
    }

    if (results.failed.length) {
      lines.push(`**Failed (${results.failed.length}):**`);
      lines.push(results.failed.map((x) => `- ${x}`).join("\n"));
    }

    return ctx.reply(lines.join("\n"));
  },
};