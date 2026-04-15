#!/usr/bin/env node
'use strict';

/**
 * One-time migration script: transcode existing uploaded videos to MP4.
 *
 * Finds every file in the database whose extension is in TRANSCODE_EXTS,
 * transcodes it to H.264 MP4 in-place, updates the DB file_path, and
 * deletes the original.
 *
 * Usage:
 *   node server/transcode-existing-videos.js [--dry-run]
 *
 * --dry-run  Print what would be done without changing anything.
 *
 * Run from inside the Docker container:
 *   docker exec -it <backend-container> node transcode-existing-videos.js
 *
 * Or locally (with UPLOADS_DIR and DB_PATH set if needed):
 *   node server/transcode-existing-videos.js
 */

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const db = require('../database');
const { toAbsolutePath, toRelativePath } = require('../fileUtils');

const TRANSCODE_EXTS = new Set(['.wmv', '.avi', '.mkv', '.mov', '.flv', '.m4v']);
const DRY_RUN = process.argv.includes('--dry-run');

function transcodeToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN — no files will be changed ---\n');

  const rows = db.prepare('SELECT id, file_path FROM files').all();

  const toConvert = rows.filter(row => {
    const ext = path.extname(row.file_path || '').toLowerCase();
    return TRANSCODE_EXTS.has(ext);
  });

  if (toConvert.length === 0) {
    console.log('No videos to transcode. Done.');
    return;
  }

  console.log(`Found ${toConvert.length} file(s) to transcode.\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const row of toConvert) {
    const inputAbs = toAbsolutePath(row.file_path);
    const ext = path.extname(row.file_path);
    const mp4Rel = row.file_path.slice(0, -ext.length) + '.mp4';
    const mp4Abs = toAbsolutePath(mp4Rel);

    if (!fs.existsSync(inputAbs)) {
      console.log(`  SKIP  (file not found on disk): ${row.file_path}`);
      skipped++;
      continue;
    }

    if (fs.existsSync(mp4Abs)) {
      console.log(`  SKIP  (mp4 already exists):     ${mp4Rel}`);
      skipped++;
      continue;
    }

    console.log(`  ${DRY_RUN ? 'WOULD TRANSCODE' : 'Transcoding'}  ${row.file_path} → ${mp4Rel}`);

    if (!DRY_RUN) {
      try {
        await transcodeToMp4(inputAbs, mp4Abs);
        db.prepare('UPDATE files SET file_path = ? WHERE id = ?').run(mp4Rel, row.id);
        fs.unlinkSync(inputAbs);
        ok++;
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        // Remove incomplete output if it was created
        if (fs.existsSync(mp4Abs)) fs.unlinkSync(mp4Abs);
        failed++;
      }
    } else {
      ok++;
    }
  }

  console.log(`\nDone. ${ok} transcoded, ${skipped} skipped, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
