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

for (const col of [
  'ALTER TABLE songs ADD COLUMN is_marching INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE songs ADD COLUMN in_marching_binder INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE songs ADD COLUMN has_a5 INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE songs ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0',
]) {
  try { db.exec(col); } catch { /* column already exists */ }
}

// One-time: migrate text status → boolean is_active
db.prepare("UPDATE songs SET is_active = 1 WHERE status = 'Aktiv' AND is_active = 0").run();

// One-time: copy in_marching_folder → in_marching_binder (column rename)
try {
  db.prepare('UPDATE songs SET in_marching_binder = in_marching_folder WHERE in_marching_folder = 1 AND in_marching_binder = 0').run();
} catch { /* in_marching_folder column may not exist on fresh installs */ }

module.exports = db;
