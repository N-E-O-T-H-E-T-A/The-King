// commands/shared/ping.js
module.exports = {
  name: "ping",
  description: "Check the bot latency.",
  aliases: ["p"],
  slash: true,
  prefix: true,
  options: [
    {
      name: "public",
      type: "boolean",
      description: "Show the response publicly",
      required: false,
    },
  ],

  async run(ctx) {
    const content = `Pong! Gateway latency: ${ctx.client.ws.ping}ms`;

    if (ctx.isSlash) {
      const isPublic = ctx.getBoolean("public", false);

      return ctx.reply({
        content,
        ephemeral: !isPublic,
      });
    }

    return ctx.reply(content);
  },
};