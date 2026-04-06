const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getAllowedRoleIds,
  setAllowedRoleIds,
  clearAllowedRoleIds,
} = require("../../../helpers/database/commandRoles");

const CUSTOM_ID_PREFIX = "cmdroles";
const BOT_OWNER_ID = "748607090875957248";

function isAllowedManager(userId, guildOwnerId) {
  return userId === BOT_OWNER_ID || userId === guildOwnerId;
}

function getManageableCommands(client) {
  return [...client.commands.values()]
    .filter((cmd) => !cmd.hidden && cmd.name !== "commandroles")
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getCommandOptions(client) {
  const commands = getManageableCommands(client);

  return commands.slice(0, 25).map((cmd) => ({
    label: cmd.name,
    description: (cmd.description || "No description").slice(0, 100),
    value: cmd.name,
  }));
}

function formatRoleMentions(roleIds) {
  if (!roleIds.length) return "None configured.";
  return roleIds.map((id) => `<@&${id}>`).join(", ");
}

function buildPanel({ client, guild, selectedCommand }) {
  const commands = getManageableCommands(client);
  const commandOptions = getCommandOptions(client);

  const currentCommand =
    commands.find((cmd) => cmd.name === selectedCommand) || commands[0];

  const currentRoleIds = currentCommand
    ? getAllowedRoleIds(guild.id, currentCommand.name)
    : [];

  const embed = new EmbedBuilder()
    .setTitle("Command Role Access")
    .setColor(0x5865f2)
    .setDescription(
      [
        "Choose a command, then choose one or more roles allowed to use it.",
        "",
        `**Selected Command:** \`${currentCommand?.name || "None"}\``,
        `**Description:** ${currentCommand?.description || "No description provided."}`,
        `**Allowed Roles:** ${formatRoleMentions(currentRoleIds)}`,
        "",
        `**Managers:** Server owner + <@${BOT_OWNER_ID}>`,
      ].join("\n")
    );

  const commandRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:command`)
      .setPlaceholder("Choose a command")
      .addOptions(
        commandOptions.map((opt) => ({
          ...opt,
          default: opt.value === currentCommand?.name,
        }))
      )
  );

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:roles:${currentCommand?.name}`)
      .setPlaceholder("Choose allowed roles")
      .setMinValues(1)
      .setMaxValues(25)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:clear:${currentCommand?.name}`)
      .setLabel("Clear Roles")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:refresh:${currentCommand?.name}`)
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [commandRow, roleRow, buttonRow],
    ephemeral: true,
    allowedMentions: { parse: [] },
  };
}

async function deny(target) {
  const payload = {
    content: "Only the server owner and the configured bot owner can use this panel.",
    ephemeral: true,
  };

  if (target.isRepliable?.()) {
    if (target.replied || target.deferred) {
      return target.followUp(payload).catch(() => {});
    }
    return target.reply(payload).catch(() => {});
  }

  return target.reply?.("Only the server owner and the configured bot owner can use this panel.").catch(() => {});
}

async function ensureAllowed(target) {
  const userId = target.user?.id || target.author?.id;
  const guildOwnerId = target.guild?.ownerId;

  if (!target.guild || !userId || !guildOwnerId) {
    await deny(target);
    return false;
  }

  if (!isAllowedManager(userId, guildOwnerId)) {
    await deny(target);
    return false;
  }

  return true;
}

async function renderPanel(target, client, selectedCommand = null) {
  if (!(await ensureAllowed(target))) return;

  const payload = buildPanel({
    client,
    guild: target.guild,
    selectedCommand,
  });

  if (target.isMessageComponent?.()) {
    return target.update(payload);
  }

  if (target.replied || target.deferred) {
    return target.followUp(payload);
  }

  return target.reply(payload);
}

module.exports = {
  name: "commandroles",
  description: "Open the role access menu for commands.",
  aliases: ["cmdroles", "rolemenu", "commandperms"],
  slash: true,
  prefix: true,
  dmPermission: false,
  adminOnly: true,
  options: [],

  async run(ctx) {
    if (!(await ensureAllowed(ctx.source))) return;
    return renderPanel(ctx.source, ctx.client, null);
  },

  async handleComponent(interaction, client) {
    if (!(await ensureAllowed(interaction))) return;

    const [, action, commandName] = interaction.customId.split(":");

    if (action === "command") {
      const selected = interaction.values[0];
      return renderPanel(interaction, client, selected);
    }

    if (action === "roles") {
      const selectedRoleIds = interaction.values || [];
      setAllowedRoleIds(interaction.guild.id, commandName, selectedRoleIds);
      return renderPanel(interaction, client, commandName);
    }

    if (action === "clear") {
      clearAllowedRoleIds(interaction.guild.id, commandName);
      return renderPanel(interaction, client, commandName);
    }

    if (action === "refresh") {
      return renderPanel(interaction, client, commandName);
    }
  },
};