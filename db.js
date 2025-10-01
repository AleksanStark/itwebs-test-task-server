const Database = require("better-sqlite3");

const db = new Database("mydb.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL
  )
`);

module.exports = db;
