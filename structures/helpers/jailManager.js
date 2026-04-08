const {
  getJailSettings,
  setJailedUser,
  getJailedUser,
  getAllJailedUsers,
  clearJailedUser,
  setStoredRoles,
  getStoredRoles,
} = require("./database/jail");

function managedRoleIds(member, jailRoleId) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id && role.id !== jailRoleId)
    .map((role) => role.id);
}

async function jailMember(member, moderatorUser, reason = "No reason was scribbled down.") {
  const settings = getJailSettings(member.guild.id);

  if (!settings?.jail_role_id) {
    throw new Error("NO_JAIL_ROLE");
  }

  const jailRole = await member.guild.roles.fetch(settings.jail_role_id).catch(() => null);
  if (!jailRole) {
    throw new Error("INVALID_JAIL_ROLE");
  }

  if (!member.manageable) {
    throw new Error("NOT_MANAGEABLE");
  }

  if (member.roles.highest.position >= member.guild.members.me.roles.highest.position) {
    throw new Error("BOT_HIERARCHY");
  }

  const existing = getJailedUser(member.guild.id, member.id);

  if (!existing) {
    const originalRoleIds = managedRoleIds(member, jailRole.id);
    setStoredRoles(member.guild.id, member.id, originalRoleIds);
  }

  const originalRoles = getStoredRoles(member.guild.id, member.id);
  await member.roles.set([jailRole.id], reason);

  setJailedUser({
    guildId: member.guild.id,
    userId: member.id,
    jailedBy: moderatorUser.id,
    reason,
  });

  return {
    jailRole,
    originalRoles,
  };
}

async function unjailMember(member, reason = "No reason was scribbled down.") {
  const settings = getJailSettings(member.guild.id);

  if (!settings?.jail_role_id) {
    throw new Error("NO_JAIL_ROLE");
  }

  const jailRole = await member.guild.roles.fetch(settings.jail_role_id).catch(() => null);
  if (!jailRole) {
    throw new Error("INVALID_JAIL_ROLE");
  }

  if (!member.manageable) {
    throw new Error("NOT_MANAGEABLE");
  }

  const storedRoleIds = getStoredRoles(member.guild.id, member.id);
  const restorableRoles = [];

  for (const roleId of storedRoleIds) {
    const role = await member.guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    if (role.id === member.guild.id) continue;
    if (role.position >= member.guild.members.me.roles.highest.position) continue;
    restorableRoles.push(role.id);
  }

  await member.roles.set(restorableRoles, reason);
  clearJailedUser(member.guild.id, member.id);

  return {
    restoredRoles: restorableRoles,
    jailRole,
  };
}

module.exports = {
  jailMember,
  unjailMember,
  getJailedUser,
  getAllJailedUsers,
};