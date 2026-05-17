const db = require("../../../database/db");

db.exec(`
  CREATE TABLE IF NOT EXISTS blocked_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    word TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(guild_id, word)
  );

  CREATE INDEX IF NOT EXISTS idx_blocked_words_guild_id
    ON blocked_words(guild_id);
`);

const insertBlockedWordStmt = db.prepare(`
  INSERT OR IGNORE INTO blocked_words (
    guild_id,
    word,
    created_at
  ) VALUES (?, ?, ?)
`);

const deleteBlockedWordStmt = db.prepare(`
  DELETE FROM blocked_words
  WHERE guild_id = ? AND word = ?
`);

const getBlockedWordsStmt = db.prepare(`
  SELECT word
  FROM blocked_words
  WHERE guild_id = ?
  ORDER BY word ASC
`);

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase();
}

function addBlockedWord(guildId, word) {
  const normalized = normalizeWord(word);
  if (!normalized) return null;

  insertBlockedWordStmt.run(
    guildId,
    normalized,
    Math.floor(Date.now() / 1000)
  );

  return normalized;
}

function removeBlockedWord(guildId, word) {
  const normalized = normalizeWord(word);
  if (!normalized) return 0;

  return deleteBlockedWordStmt.run(guildId, normalized).changes;
}

function getBlockedWords(guildId) {
  return getBlockedWordsStmt.all(guildId).map((row) => row.word);
}

module.exports = {
  addBlockedWord,
  removeBlockedWord,
  getBlockedWords,
};