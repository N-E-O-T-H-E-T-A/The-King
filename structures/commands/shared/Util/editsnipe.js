const { EmbedBuilder } = require("discord.js");
const { getLatestEditedInChannel } = require("../../../helpers/database/messageLogs");

function formatAttachments(urls) {
  if (!urls?.length) return "None";
  return urls.map((u, i) => `[Attachment ${i + 1}](${u})`).join("\n").slice(0, 1024);
}

module.exports = {
  name: "editsnipe",
  description: "Show the most recently edited message in this channel.",
  aliases: ["esnipe", "edited"],
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

    const record = getLatestEditedInChannel(
      ctx.guild.id,
      ctx.channel.id,
      targetUser?.id || null
    );

    if (!record) {
      return ctx.reply("I couldn't find any recently edited messages here.");
    }

    const embed = new EmbedBuilder()
      .setTitle("Edited Message")
      .setColor(0xfee75c)
      .addFields(
        {
          name: "Author",
          value: `${record.author_tag} (\`${record.author_id}\`)`,
          inline: false,
        },
        {
          name: "Edited",
          value: `<t:${record.edited_at}:f> (<t:${record.edited_at}:R>)`,
          inline: false,
        },
        {
          name: "Before",
          value: record.old_content?.trim() ? record.old_content.slice(0, 1024) : "*[no text content]*",
          inline: false,
        },
        {
          name: "After",
          value: record.new_content?.trim() ? record.new_content.slice(0, 1024) : "*[no text content]*",
          inline: false,
        }
      );

    if (record.old_attachment_urls?.length || record.new_attachment_urls?.length) {
      embed.addFields(
        {
          name: "Old Attachments",
          value: formatAttachments(record.old_attachment_urls),
          inline: false,
        },
        {
          name: "New Attachments",
          value: formatAttachments(record.new_attachment_urls),
          inline: false,
        }
      );
    }

    return ctx.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};