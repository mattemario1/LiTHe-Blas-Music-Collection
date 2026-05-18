/**
 * One-time migration: rename song directories from songs/{name}/ to songs/{name}-{id}/
 * and update all file_path values in the DB to match.
 *
 * Run inside the backend container:
 *   node scripts/migrate-song-dirs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/music.db');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
const DRY_RUN = process.argv.includes('--dry-run');

const sanitize = (str) => {
  if (!str) return '';
  return str
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .normalize('NFC');
};

const db = new Database(DB_PATH);
const songs = db.prepare('SELECT id, name FROM songs').all();

console.log(`Found ${songs.length} songs. DRY_RUN=${DRY_RUN}\n`);

let renamed = 0;
let skipped = 0;
let alreadyDone = 0;

for (const song of songs) {
  const safeName = sanitize(song.name) || 'Song';
  const oldDirName = safeName;
  const newDirName = `${safeName}-${song.id}`;

  const oldAbsDir = path.join(UPLOADS_DIR, 'songs', oldDirName);
  const newAbsDir = path.join(UPLOADS_DIR, 'songs', newDirName);

  if (!fs.existsSync(oldAbsDir)) {
    if (fs.existsSync(newAbsDir)) {
      alreadyDone++;
    } else {
      // No directory at all — nothing to migrate
    }
    continue;
  }

  if (fs.existsSync(newAbsDir)) {
    console.warn(`SKIP song ${song.id} "${song.name}": target ${newDirName} already exists`);
    skipped++;
    continue;
  }

  // Collect old→new path mappings for DB update
  const updates = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const relNew = path.relative(UPLOADS_DIR, full).replace(
          `songs/${oldDirName}/`,
          `songs/${newDirName}/`
        );
        const relOld = path.relative(UPLOADS_DIR, full);
        updates[relOld] = relNew;
      }
    }
  };
  walk(oldAbsDir);

  console.log(`Song ${song.id} "${song.name}": ${oldDirName} → ${newDirName} (${Object.keys(updates).length} files)`);

  if (!DRY_RUN) {
    fs.renameSync(oldAbsDir, newAbsDir);

    const updateStmt = db.prepare('UPDATE files SET file_path = ? WHERE file_path = ? AND song_id = ?');
    const migrate = db.transaction(() => {
      for (const [oldRel, newRel] of Object.entries(updates)) {
        updateStmt.run(newRel, oldRel, song.id);
      }
    });
    migrate();
  }

  renamed++;
}

console.log(`\nDone. Renamed: ${renamed}, Already migrated: ${alreadyDone}, Skipped (conflict): ${skipped}`);
if (DRY_RUN) console.log('(dry run — no changes made)');
