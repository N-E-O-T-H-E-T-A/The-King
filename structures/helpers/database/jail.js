const db = require("../../../database/db");

db.exec(`
  CREATE TABLE IF NOT EXISTS jail_settings (
    guild_id TEXT PRIMARY KEY,
    jail_role_id TEXT,
    jail_channel_id TEXT
  );

  CREATE TABLE IF NOT EXISTS jailed_users (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    jailed_by TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS jailed_user_roles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, role_id)
  );
`);

const ensureSettingsStmt = db.prepare(`
  INSERT OR IGNORE INTO jail_settings (guild_id)
  VALUES (?)
`);

const getSettingsStmt = db.prepare(`
  SELECT *
  FROM jail_settings
  WHERE guild_id = ?
`);

const setJailRoleStmt = db.prepare(`
  UPDATE jail_settings
  SET jail_role_id = ?
  WHERE guild_id = ?
`);

const setJailChannelStmt = db.prepare(`
  UPDATE jail_settings
  SET jail_channel_id = ?
  WHERE guild_id = ?
`);

const setJailedUserStmt = db.prepare(`
  INSERT INTO jailed_users (
    guild_id,
    user_id,
    jailed_by,
    reason,
    created_at
  ) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET
    jailed_by = excluded.jailed_by,
    reason = excluded.reason,
    created_at = excluded.created_at
`);

const getJailedUserStmt = db.prepare(`
  SELECT *
  FROM jailed_users
  WHERE guild_id = ? AND user_id = ?
`);

const getAllJailedUsersStmt = db.prepare(`
  SELECT *
  FROM jailed_users
  WHERE guild_id = ?
  ORDER BY created_at ASC
`);

const clearJailedUserStmt = db.prepare(`
  DELETE FROM jailed_users
  WHERE guild_id = ? AND user_id = ?
`);

const clearStoredRolesStmt = db.prepare(`
  DELETE FROM jailed_user_roles
  WHERE guild_id = ? AND user_id = ?
`);

const insertStoredRoleStmt = db.prepare(`
  INSERT OR IGNORE INTO jailed_user_roles (
    guild_id,
    user_id,
    role_id
  ) VALUES (?, ?, ?)
`);

const getStoredRolesStmt = db.prepare(`
  SELECT role_id
  FROM jailed_user_roles
  WHERE guild_id = ? AND user_id = ?
  ORDER BY role_id ASC
`);

const setStoredRolesTxn = db.transaction((guildId, userId, roleIds) => {
  clearStoredRolesStmt.run(guildId, userId);
  for (const roleId of roleIds) {
    insertStoredRoleStmt.run(guildId, userId, roleId);
  }
});

function ensureJailSettings(guildId) {
  ensureSettingsStmt.run(guildId);
  return getSettingsStmt.get(guildId);
}

function getJailSettings(guildId) {
  return getSettingsStmt.get(guildId) || ensureJailSettings(guildId);
}

function setJailRole(guildId, roleId) {
  ensureJailSettings(guildId);
  setJailRoleStmt.run(roleId, guildId);
  return getJailSettings(guildId);
}

function setJailChannel(guildId, channelId) {
  ensureJailSettings(guildId);
  setJailChannelStmt.run(channelId, guildId);
  return getJailSettings(guildId);
}

function setJailedUser({ guildId, userId, jailedBy, reason = null, createdAt = Math.floor(Date.now() / 1000) }) {
  setJailedUserStmt.run(guildId, userId, jailedBy, reason, createdAt);
  return getJailedUser(guildId, userId);
}

function getJailedUser(guildId, userId) {
  return getJailedUserStmt.get(guildId, userId) || null;
}

function getAllJailedUsers(guildId) {
  return getAllJailedUsersStmt.all(guildId);
}

function clearJailedUser(guildId, userId) {
  clearJailedUserStmt.run(guildId, userId);
  clearStoredRolesStmt.run(guildId, userId);
}

function setStoredRoles(guildId, userId, roleIds) {
  setStoredRolesTxn(guildId, userId, [...new Set(roleIds)]);
}

function getStoredRoles(guildId, userId) {
  return getStoredRolesStmt.all(guildId, userId).map((r) => r.role_id);
}

module.exports = {
  ensureJailSettings,
  getJailSettings,
  setJailRole,
  setJailChannel,
  setJailedUser,
  getJailedUser,
  getAllJailedUsers,
  clearJailedUser,
  setStoredRoles,
  getStoredRoles,
};