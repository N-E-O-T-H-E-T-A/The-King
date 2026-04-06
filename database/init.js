const fs = require("node:fs");
const path = require("node:path");
const db = require("./db");

function initDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema);
  console.log("✅ Database initialized");
}

module.exports = initDatabase;