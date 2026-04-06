module.exports = {
  name: "say",
  description: "Make the bot say something",
  aliases: ["repeat"],
  slash: true,
  prefix: true,

  options: [
    {
      name: "text",
      type: "string",
      description: "What should the bot say?",
      required: true,
    },
    {
      name: "public",
      type: "boolean",
      description: "Show publicly (slash only)",
      required: false,
    },
  ],

  async run(ctx) {
    let text;

    // ===== SLASH =====
    if (ctx.isSlash) {
      text = ctx.getString("text");
      const isPublic = ctx.getBoolean("public", false);

      return ctx.reply({
        content: text,
        ephemeral: !isPublic,
        allowedMentions: { parse: [] },
      });
    }

    // ===== PREFIX =====
    text = ctx.args.join(" ");

    if (!text) return;

    // delete the original command message
    await ctx.source.delete().catch(() => {});

    // send message normally (NOT reply)
    return ctx.channel.send({
      content: text,
      allowedMentions: { parse: [] },
    });
  },
};