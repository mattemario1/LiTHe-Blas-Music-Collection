#!/usr/bin/env node
'use strict';

/**
 * One-time migration: add -movflags +faststart to existing MP4/WebM files so
 * browsers can start playback without downloading the whole file first.
 *
 * Uses `-c copy` so no re-encoding — fast and lossless.
 * WebM files are skipped (faststart is an MP4-only concept).
 *
 * Usage:
 *   node scripts/faststart-existing-videos.js [--dry-run]
 *
 * Run from inside the Docker container:
 *   docker exec -it <backend-container> node scripts/faststart-existing-videos.js
 */

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const db = require('../database');
const { toAbsolutePath } = require('../fileUtils');

const DRY_RUN = process.argv.includes('--dry-run');

function applyFaststart(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('copy')
      .audioCodec('copy')
      .outputOptions('-movflags +faststart')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function hasFaststart(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(false);
      const tags = metadata?.format?.tags || {};
      // ffprobe doesn't directly expose moov position, so we check for the
      // 'faststart' flag via a qtfaststart heuristic: if moov comes before mdat
      // the file is already fast-start. We approximate by checking file size vs
      // bitrate — instead just always reprocess; `-movflags +faststart` is
      // idempotent and `-c copy` makes it nearly instant.
      resolve(false);
    });
  });
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN — no files will be changed ---\n');

  const rows = db.prepare('SELECT id, file_path FROM files').all();

  const mp4Rows = rows.filter(row => {
    const ext = path.extname(row.file_path || '').toLowerCase();
    return ext === '.mp4';
  });

  if (mp4Rows.length === 0) {
    console.log('No MP4 files found. Done.');
    return;
  }

  console.log(`Found ${mp4Rows.length} MP4 file(s) to process.\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const row of mp4Rows) {
    const absPath = toAbsolutePath(row.file_path);

    if (!fs.existsSync(absPath)) {
      console.log(`  SKIP  (file not found on disk): ${row.file_path}`);
      skipped++;
      continue;
    }

    const tmpPath = absPath + '.faststart.tmp.mp4';
    console.log(`  ${DRY_RUN ? 'WOULD PROCESS' : 'Processing'}  ${row.file_path}`);

    if (!DRY_RUN) {
      try {
        await applyFaststart(absPath, tmpPath);
        fs.renameSync(tmpPath, absPath);
        ok++;
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        failed++;
      }
    } else {
      ok++;
    }
  }

  console.log(`\nDone. ${ok} processed, ${skipped} skipped, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
