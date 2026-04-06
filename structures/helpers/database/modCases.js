const db = require("../../../database/db");

db.exec(`
  CREATE TABLE IF NOT EXISTS mod_cases (
    case_id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_mod_cases_guild_id
  ON mod_cases(guild_id);

  CREATE INDEX IF NOT EXISTS idx_mod_cases_user_id
  ON mod_cases(user_id);

  CREATE INDEX IF NOT EXISTS idx_mod_cases_action_type
  ON mod_cases(action_type);
`);

const insertCaseStmt = db.prepare(`
  INSERT INTO mod_cases (
    guild_id,
    user_id,
    moderator_id,
    action_type,
    reason,
    created_at,
    expires_at,
    active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getCaseStmt = db.prepare(`
  SELECT *
  FROM mod_cases
  WHERE case_id = ?
`);

const getGuildCaseStmt = db.prepare(`
  SELECT *
  FROM mod_cases
  WHERE guild_id = ? AND case_id = ?
`);

const getUserCasesStmt = db.prepare(`
  SELECT *
  FROM mod_cases
  WHERE guild_id = ? AND user_id = ?
  ORDER BY case_id DESC
  LIMIT ?
`);

const updateCaseReasonStmt = db.prepare(`
  UPDATE mod_cases
  SET reason = ?
  WHERE guild_id = ? AND case_id = ?
`);

const setCaseActiveStmt = db.prepare(`
  UPDATE mod_cases
  SET active = ?
  WHERE guild_id = ? AND case_id = ?
`);

function createModCase({
  guildId,
  userId,
  moderatorId,
  actionType,
  reason = null,
  createdAt = Math.floor(Date.now() / 1000),
  expiresAt = null,
  active = 1,
}) {
  const result = insertCaseStmt.run(
    guildId,
    userId,
    moderatorId,
    actionType,
    reason,
    createdAt,
    expiresAt,
    active
  );

  return getCaseStmt.get(result.lastInsertRowid);
}

function getModCase(caseId) {
  return getCaseStmt.get(caseId) || null;
}

function getGuildCase(guildId, caseId) {
  return getGuildCaseStmt.get(guildId, caseId) || null;
}

function getUserCases(guildId, userId, limit = 10) {
  return getUserCasesStmt.all(guildId, userId, limit);
}

function updateCaseReason(guildId, caseId, reason) {
  updateCaseReasonStmt.run(reason, guildId, caseId);
  return getGuildCase(guildId, caseId);
}

function setCaseActive(guildId, caseId, active) {
  setCaseActiveStmt.run(active ? 1 : 0, guildId, caseId);
  return getGuildCase(guildId, caseId);
}

module.exports = {
  createModCase,
  getModCase,
  getGuildCase,
  getUserCases,
  updateCaseReason,
  setCaseActive,
};