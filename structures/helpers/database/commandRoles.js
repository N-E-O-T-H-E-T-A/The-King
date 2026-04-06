const db = require("../../../database/db");

db.exec(`
  CREATE TABLE IF NOT EXISTS command_role_permissions (
    guild_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, command_name, role_id)
  );

  CREATE INDEX IF NOT EXISTS idx_command_role_permissions_guild_command
  ON command_role_permissions(guild_id, command_name);
`);

const getAllowedRolesStmt = db.prepare(`
  SELECT role_id
  FROM command_role_permissions
  WHERE guild_id = ? AND command_name = ?
  ORDER BY role_id ASC
`);

const clearAllowedRolesStmt = db.prepare(`
  DELETE FROM command_role_permissions
  WHERE guild_id = ? AND command_name = ?
`);

const insertAllowedRoleStmt = db.prepare(`
  INSERT OR IGNORE INTO command_role_permissions (
    guild_id,
    command_name,
    role_id
  ) VALUES (?, ?, ?)
`);

const setAllowedRolesTxn = db.transaction((guildId, commandName, roleIds) => {
  clearAllowedRolesStmt.run(guildId, commandName);

  for (const roleId of roleIds) {
    insertAllowedRoleStmt.run(guildId, commandName, roleId);
  }
});

function getAllowedRoleIds(guildId, commandName) {
  return getAllowedRolesStmt
    .all(guildId, commandName.toLowerCase())
    .map((row) => row.role_id);
}

function setAllowedRoleIds(guildId, commandName, roleIds) {
  const uniqueRoleIds = [...new Set(roleIds)];
  setAllowedRolesTxn(guildId, commandName.toLowerCase(), uniqueRoleIds);
  return getAllowedRoleIds(guildId, commandName);
}

function clearAllowedRoleIds(guildId, commandName) {
  clearAllowedRolesStmt.run(guildId, commandName.toLowerCase());
}

module.exports = {
  getAllowedRoleIds,
  setAllowedRoleIds,
  clearAllowedRoleIds,
};