const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "king.db");

const db = new Database(dbPath);

// Better durability defaults for a bot database
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;