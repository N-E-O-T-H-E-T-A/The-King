const fs = require("node:fs");
const path = require("node:path");
const db = require("./db");

function initDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema);
  console.log("✅ Database initialized");
}
db.exec(`
  CREATE TABLE IF NOT EXISTS temp_bans (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_temp_bans_expires_at
  ON temp_bans(expires_at);

  CREATE INDEX IF NOT EXISTS idx_temp_bans_active
  ON temp_bans(active);
`);

module.exports = initDatabase;