function formatOption(option) {
  const required = option.required ? "required" : "optional";
  return `\`${option.name}\` (${option.type}, ${required})`;
}

function buildCommandUsage(command, prefix) {
  const prefixName = `${prefix}${command.name}`;
  const slashName = `/${command.name}`;

  const optionText = Array.isArray(command.options) && command.options.length
    ? command.options.map(formatOption).join(", ")
    : "No options";

  return {
    title: command.name,
    description: command.description || "No description provided.",
    category: command.category || "misc",
    aliases:
      Array.isArray(command.aliases) && command.aliases.length
        ? command.aliases.map((a) => `\`${a}\``).join(", ")
        : "None",
    usage: [
      command.prefix ? `**Prefix:** \`${prefixName}\`` : null,
      command.slash ? `**Slash:** \`${slashName}\`` : null,
      `**Options:** ${optionText}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildHelpMap(commands, prefix) {
  const categories = new Map();

  for (const command of commands.values()) {
    const formatted = buildCommandUsage(command, prefix);
    const category = formatted.category;

    if (!categories.has(category)) {
      categories.set(category, []);
    }

    categories.get(category).push(formatted);
  }

  for (const [, list] of categories) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  return categories;
}

module.exports = { buildHelpMap };