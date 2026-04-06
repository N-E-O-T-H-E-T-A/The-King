const { EmbedBuilder } = require("discord.js");
const { getLatestDeletedInChannel } = require("../../../helpers/database/messageLogs");

function formatAttachments(urls) {
  if (!urls?.length) return "None";
  return urls.map((u, i) => `[Attachment ${i + 1}](${u})`).join("\n").slice(0, 1024);
}

module.exports = {
  name: "snipe",
  description: "Show the most recently deleted message in this channel.",
  aliases: ["deleted"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "user",
      type: "user",
      description: "Optional user filter",
      required: false,
    },
  ],

  async run(ctx) {
    if (!ctx.guild) {
      return ctx.reply("This only works in a server.");
    }

    let targetUser = null;

    if (ctx.isSlash) {
      targetUser = ctx.getUser("user", null);
    } else {
      targetUser =
        ctx.source.mentions.users.first() ||
        (ctx.args[0] ? await ctx.client.users.fetch(ctx.args[0]).catch(() => null) : null);
    }

    const record = getLatestDeletedInChannel(
      ctx.guild.id,
      ctx.channel.id,
      targetUser?.id || null
    );

    if (!record) {
      return ctx.reply("I couldn't find any recently deleted messages here.");
    }

    const embed = new EmbedBuilder()
      .setTitle("Deleted Message")
      .setColor(0xed4245)
      .addFields(
        {
          name: "Author",
          value: `${record.author_tag} (\`${record.author_id}\`)`,
          inline: false,
        },
        {
          name: "Deleted",
          value: `<t:${record.deleted_at}:f> (<t:${record.deleted_at}:R>)`,
          inline: false,
        },
        {
          name: "Content",
          value: record.content?.trim() ? record.content.slice(0, 1024) : "*[no text content]*",
          inline: false,
        }
      );

    if (record.attachment_urls?.length) {
      embed.addFields({
        name: "Attachments",
        value: formatAttachments(record.attachment_urls),
        inline: false,
      });
    }

    return ctx.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};