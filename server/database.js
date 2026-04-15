const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use DB_PATH env var if set (from docker-compose), otherwise default to local data folder
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'music.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys - SQLite has them off by default
db.pragma('foreign_keys = ON');

// Create all tables if they don't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cover_path TEXT DEFAULT '',
    description TEXT DEFAULT '',
    year TEXT DEFAULT '',
    song_order TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    type TEXT DEFAULT '',
    status TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    name TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    asset_type TEXT NOT NULL,
    file_path TEXT DEFAULT '',
    name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    date TEXT DEFAULT '',
    album TEXT DEFAULT '',
    instrument TEXT DEFAULT '',
    duration REAL DEFAULT 0
  );
`);

module.exports = db;
