const { PermissionFlagsBits } = require("discord.js");
const { getAllowedRoleIds } = require("./database/commandRoles");

function canUseCommandByConfiguredRoles(member, guild, commandName) {
  if (!member || !guild || !commandName) {
    return { allowed: true, configured: false, roleIds: [] };
  }

  const roleIds = getAllowedRoleIds(guild.id, commandName.toLowerCase());

  if (!roleIds.length) {
    return { allowed: true, configured: false, roleIds: [] };
  }

  if (
    guild.ownerId === member.id ||
    member.id === process.env.OWNER_ID
  ) {
    return { allowed: true, configured: true, bypass: true, roleIds };
  }

  const hasAllowedRole = member.roles.cache.some((role) => roleIds.includes(role.id));

  return {
    allowed: hasAllowedRole,
    configured: true,
    bypass: false,
    roleIds,
  };
}

module.exports = {
  canUseCommandByConfiguredRoles,
};