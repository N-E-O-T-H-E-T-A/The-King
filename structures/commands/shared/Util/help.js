const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildHelpMap } = require("../../../helpers/buildHelpData");

function getCategoryList(helpMap) {
  return [...helpMap.keys()].sort((a, b) => a.localeCompare(b));
}

function buildCategoryEmbed({ ctx, category, commands, page, totalPages }) {
  const start = page * 6;
  const pageItems = commands.slice(start, start + 6);

  const embed = new EmbedBuilder()
    .setTitle(`Help • ${category}`)
    .setDescription("Use the menu to switch categories.")
    .setFooter({ text: `Page ${page + 1} / ${totalPages}` });

  for (const cmd of pageItems) {
    embed.addFields({
      name: `/${cmd.title}`,
      value: [
        cmd.description,
        cmd.usage,
        `**Aliases:** ${cmd.aliases}`,
      ].join("\n"),
    });
  }

  return embed;
}

function buildComponents({ categories, currentCategory, page, totalPages }) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`help_select:${currentCategory}:${page}`)
    .setPlaceholder("Choose a category")
    .addOptions(
      categories.map(cat => ({
        label: cat,
        value: cat,
        default: cat === currentCategory,
      }))
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_page:first:${currentCategory}`)
      .setLabel("≪")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`help_page:prev:${currentCategory}`)
      .setLabel("‹")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`help_page:next:${currentCategory}`)
      .setLabel("›")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`help_page:last:${currentCategory}`)
      .setLabel("≫")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );

  const menuRow = new ActionRowBuilder().addComponents(select);

  return [menuRow, buttons];
}

async function renderHelp(target, ctx, category, page = 0) {
  const helpMap = buildHelpMap(ctx.client.commands, ctx.client.config.prefix);
  const categories = getCategoryList(helpMap);

  if (!categories.length) {
    const payload = { content: "No commands found." };
    if (target.update) return target.update(payload);
    return target.reply(payload);
  }

  const chosenCategory = helpMap.has(category) ? category : categories[0];
  const commands = helpMap.get(chosenCategory);
  const totalPages = Math.max(1, Math.ceil(commands.length / 6));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);

  const embed = buildCategoryEmbed({
    ctx,
    category: chosenCategory,
    commands,
    page: safePage,
    totalPages,
  });

  const components = buildComponents({
    categories,
    currentCategory: chosenCategory,
    page: safePage,
    totalPages,
  });

  const payload = {
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
  };

  if (target.update) return target.update(payload);

  if (target.replied || target.deferred) {
    return target.followUp(payload);
  }

  return target.reply(payload);
}

module.exports = {
  name: "help",
  description: "View all commands and how to use them.",
  aliases: ["h", "commands"],
  slash: true,
  prefix: true,
  options: [],

  async run(ctx) {
    return renderHelp(ctx.source, ctx, null, 0);
  },

  renderHelp,
};