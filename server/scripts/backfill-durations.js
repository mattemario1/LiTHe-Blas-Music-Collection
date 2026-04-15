#!/usr/bin/env node
'use strict';

/**
 * One-time migration script: fill in missing durations for recording files.
 *
 * Finds every recording file in the database where duration is 0 or NULL,
 * probes the actual file with ffprobe, and updates the DB.
 *
 * Usage:
 *   node server/backfill-durations.js [--dry-run]
 *
 * --dry-run  Print what would be updated without changing anything.
 *
 * Run from inside the Docker container:
 *   docker exec -it <backend-container> node backfill-durations.js
 *
 * Or locally (with UPLOADS_DIR and DB_PATH set if needed):
 *   node server/backfill-durations.js
 */

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const db = require('../database');
const { toAbsolutePath } = require('../fileUtils');

const DRY_RUN = process.argv.includes('--dry-run');

const MEDIA_EXTS = new Set(['.mp3', '.mp4', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.wmv', '.avi', '.mkv', '.mov', '.flv', '.m4v', '.webm', '.ogv', '.opus']);

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN — no changes will be made ---\n');

  const rows = db
    .prepare(`SELECT id, file_path FROM files WHERE duration IS NULL OR duration = 0`)
    .all();

  if (rows.length === 0) {
    console.log('No recordings with missing durations. Done.');
    return;
  }

  console.log(`Found ${rows.length} recording(s) with missing duration.\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const absPath = toAbsolutePath(row.file_path);
    const ext = path.extname(row.file_path).toLowerCase();

    if (!MEDIA_EXTS.has(ext)) {
      skipped++;
      continue;
    }

    if (!fs.existsSync(absPath)) {
      console.log(`  SKIP  (file not found on disk): ${row.file_path}`);
      skipped++;
      continue;
    }

    try {
      const duration = await probeDuration(absPath);
      console.log(`  ${DRY_RUN ? 'WOULD SET' : 'SET'} duration=${formatDuration(duration)} (${duration.toFixed(2)}s)  ${row.file_path}`);
      if (!DRY_RUN) {
        db.prepare('UPDATE files SET duration = ? WHERE id = ?').run(duration, row.id);
      }
      ok++;
    } catch (err) {
      console.error(`  FAILED (${row.file_path}): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} updated, ${skipped} skipped, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
