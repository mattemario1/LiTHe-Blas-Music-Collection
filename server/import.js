#!/usr/bin/env node
'use strict';

/**
 * Bulk import script for the LiTHe Blas music collection.
 *
 * Usage:
 *   node server/import.js <source_dir> [--dry-run]
 *
 * source_dir should point to the folder containing one subdirectory per song,
 * e.g. /path/to/output_folder/Inspelningar_Danser_och_Noter
 *
 * Each song directory may contain:
 *   Inspelningar/  → recordings
 *   Noter/         → sheet music (sub-subfolders become collections)
 *   Dans/          → dance videos / instructions (imported as otherFiles)
 *   Root .txt/.pdf named *sångtext* → lyrics
 *   Root audio files → recordings
 *   Root .pdf files → sheet music
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');
const {
  sanitize,
  getSongAssetDir,
  constructFileName,
  resolveUniqueFilePath,
  toRelativePath,
  getUploadsBase,
} = require('./fileUtils');

// ─── CLI args ────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE_DIR = process.argv.slice(2).find(a => !a.startsWith('-'));

if (!SOURCE_DIR) {
  console.error('Usage: node server/import.js <source_dir> [--dry-run]');
  process.exit(1);
}
if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

// ─── Extension sets ──────────────────────────────────────────────────────────

const AUDIO_EXTS  = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma']);
const VIDEO_EXTS  = new Set(['.avi', '.wmv', '.mpg', '.mpeg', '.mp4', '.mov', '.MOV', '.MPG']);
const SCORE_EXTS  = new Set(['.sib', '.mscz', '.mid', '.midi']);
const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const SKIP_EXTS   = new Set(['.docx', '.xlsx', '.doc', '.lnk', '.ds_store']);

function isAudioVideo(ext) {
  ext = ext.toLowerCase();
  return AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}
function shouldSkip(ext) {
  return SKIP_EXTS.has(ext.toLowerCase()) || ext === '';
}
function isLyricFile(name) {
  return /s[åa]ng[^.]*text|lyrics|sung|text\b/i.test(name);
}

// ─── Instrument normalization ─────────────────────────────────────────────────

const VERSION_QUALIFIER_RE =
  /\s*[\-–]?\s*\b(renskriven|spelbar\s+trio|spelbar|ny|gammal|kort|alternativ|a5|a4|ver\s*\d[\w.]*|\d{4}|tom|oskar|lars|jocke|joakim|lc)\b/gi;

function normalizeInstrument(raw) {
  if (!raw || !raw.trim()) return raw;

  // Extract and strip version qualifiers
  const qualifiers = [];
  let s = raw.replace(VERSION_QUALIFIER_RE, m => { qualifiers.push(m.trim()); return ''; })
             .replace(/[_\-,;]+$/, '').trim();

  // ── Pre-process: normalize spacing and separators ──────────────────────────
  s = s
    .replace(/\(\d+\)\s*$/, '')                             // strip Windows dup suffix: (1), (2)
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, '$1')           // ordinals: 1st→1, 2nd→2
    .replace(/\b(IV|III|II|I)\b/g, m => ({'I':'1','II':'2','III':'3','IV':'4'}[m] || m)) // Roman→Arabic
    .replace(/\b\d+\.\d+\b/g, '')                          // strip decimal versions: 4.0, 1.1
    .replace(/([A-Za-zåäöÅÄÖ])(\d)/g, '$1 $2')            // Trb1 → Trb 1
    .replace(/(\d)([A-Za-zåäöÅÄÖ])/g, '$1 $2')            // 2Trb → 2 Trb
    .replace(/\s*[&+]\s*/g, ' och ')                        // & or + → och
    .replace(/\s*,\s*/g, ' och ')                           // comma → och
    .replace(/(\d)\s*-\s*(\d)/g, '$1 och $2')              // 2-3 → 2 och 3
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── Collect part numbers near the first instrument keyword ──────────────────
  const INSTR_KW_RE = /\b(piccol|fl[öo]jt|floejt|flute|fl|klar(?:inett)?|clarinet|kl|basklarinett|altklar|ebklar|baryton|barsax|altsax|tensax|tenorsax|sopransax|soprano|trombon|trombone|basun|tro|trb|flygelhorn|flugelhorn|trump|trp|trumpet|kornett|tenorhorn|valthorn|horn|tuba|elbas|kontrabas|banjo|trumset|drumset|trummor|batteri|slagverk|partitur|conductor|s[åa]ng|vocal|komp|gitarr|guitar|piano|oboe|fagott|violin|cello|eufonium)\b/i;
  const kwMatch = INSTR_KW_RE.exec(s);
  const kwIdx   = kwMatch ? kwMatch.index : s.length;
  // Numbers within 10 chars before keyword (e.g. "1 Trumpet") + all after
  const beforeKw = kwMatch ? s.slice(Math.max(0, kwIdx - 10), kwIdx) : '';
  const afterKw  = kwMatch ? s.slice(kwIdx) : s;
  const rawNums  = [
    ...[...beforeKw.matchAll(/\d+/g)].map(m => m[0]),
    ...[...afterKw.matchAll(/\d+/g)].map(m => m[0]),
  ];
  // Split 2-digit concatenated part numbers (23 → 2 och 3) when both digits are 1-4
  const nums = [];
  for (const n of rawNums) {
    if (n.length === 2 && n[0] >= '1' && n[0] <= '4' && n[1] >= '1' && n[1] <= '4') {
      nums.push(n[0], n[1]);
    } else {
      nums.push(n);
    }
  }
  const numStr = nums.length > 0 ? ' ' + nums.join(' och ') : '';

  // ── Detect multiple distinct instrument types → return from first keyword ──
  const MULTI_KW_RE = /\b(fl[öo]jt|fl|klarinett|klar|clarinet|trombon|trombone|tro|trb|trump|trumpet|trp|kornett|flygelhorn|tenorhorn|altsax|tensax|tenorsax|barytonsax|sopransax|horn|tuba|elbas|bas|banjo|trummor|partitur)\b/gi;
  const multiMatches = [...s.matchAll(MULTI_KW_RE)];
  if (multiMatches.length > 1) {
    const qualStr = qualifiers.length > 0 ? ' ' + qualifiers.join(' ') : '';
    return (s.slice(multiMatches[0].index) + qualStr).trim();
  }

  let canonical = null;

  // Piccolo (check before flute)
  if (/piccol[ao]fl[öo]jt|piccolo|piccola/i.test(s)) {
    canonical = 'Piccola';
  }
  // Flute
  else if (/fl[öo][jt]|floejt|tvaerfl[öo]jt|tvärtfl[öo]jt|flute|fl[öo]t\b|\bfl\b/i.test(s)) {
    canonical = 'Flöjt' + numStr;
  }
  // Clarinet – check subtype first
  else if (/basklarinett|basklar|bas\s*klarinett|bass\s*clar/i.test(s)) {
    canonical = 'Basklarinett';
  }
  else if (/altklarinett|alt\s*klarinett|alt\s*clar/i.test(s)) {
    canonical = 'Altklarinett';
  }
  else if (/ebklarinett|eb\s*klar|eb\s*clar/i.test(s)) {
    canonical = 'Eb Klarinett';
  }
  else if (/klar|klarinett|clarinet|\bkl\b/i.test(s)) {
    canonical = 'Klarinett' + numStr;
  }
  // Bari sax (before other sax to avoid partial match)
  else if (/bar[ry]*[yi]ton?sax|baritonsax|baritone?\s*sax|barsax|barre\s*sax|barresax|barrytonsax|barrtonsax/i.test(s)) {
    canonical = 'Barytonsax';
  }
  // Alto sax
  else if (/altsax|alt\s*sax|alto\s*sax|altsaxofon|altsaxophone|eb\s*altsax|eb\s*alt/i.test(s)) {
    canonical = 'Altsax' + numStr;
  }
  // Tenor sax
  else if (/tensax|tenorsax|tenor\s*sax|tenorsaxofon|tenor\s*saxophone/i.test(s)) {
    canonical = 'Tenorsax' + numStr;
  }
  // Sopran sax
  else if (/sopransax|soprano\s*sax/i.test(s)) {
    canonical = 'Sopransax';
  }
  // Trombone
  else if (/\btrb\b|trombon|trombone|basun\b|\btro\b/i.test(s)) {
    canonical = 'Trombon' + numStr;
  }
  // Trumpet / Flugelhorn / Kornett
  else if (/fl[üu]gelhorn|flygelhorn|flugelhorn/i.test(s)) {
    canonical = 'Flygelhorn' + numStr;
  }
  else if (/\btrp\b|trumpet|kornett|\btrump\b/i.test(s)) {
    canonical = 'Trumpet' + numStr;
  }
  // Horn (F-horn / valhorn) – after tenorhorn check
  else if (/tenorhorn|ten\.?\s*horn/i.test(s)) {
    canonical = 'Tenorhorn' + numStr;
  }
  else if (/f[-\s]?horn|horn\s*i\s*f|valthorn|\bhornN|horn\b/i.test(s)) {
    canonical = 'Horn' + numStr;
  }
  // Tuba
  else if (/tuba/i.test(s)) {
    canonical = 'Tuba';
  }
  // Bass — all variants map to Elbas
  else if (/elbas|electric\s*bass|bass\s*guitar|el\s*bas|elbass|str[äa]ngbas|kontrabas|string\s*bass|double\s*bass|\bbas\b(?!\s*klarinett|\s*tuba|\s*drum|\s*clar|\s*bass)/i.test(s)) {
    canonical = 'Elbas';
  }
  // Banjo
  else if (/banjo/i.test(s)) {
    canonical = 'Banjo';
  }
  // Drums / percussion — all variants map to Trummor
  else if (/trumset|drumset|drum\s*set|trummor|drums?\b|batteri|slagverk|percussion|snare|virvel|klockspel|lyra|tamburin|pukor|timpani|cymbal|beckar|bastrumma/i.test(s)) {
    canonical = 'Trummor';
  }
  // Score / partitur
  else if (/partitur|full\s*score|conductor|dirigent/i.test(s)) {
    canonical = 'Partitur';
  }
  // Voice / lyrics
  else if (/s[åa]ng|vocal|sang\b|voice|text/i.test(s)) {
    canonical = 'Sång';
  }
  // Rhythm / komp
  else if (/\bkomp\b/i.test(s)) {
    canonical = 'Komp';
  }
  // Instruments
  else if (/gitarr|guitar/i.test(s)) {
    canonical = 'Gitarr';
  }
  else if (/piano|klaviatur|keyboard/i.test(s)) {
    canonical = 'Piano';
  }
  else if (/oboe/i.test(s)) { canonical = 'Oboe'; }
  else if (/fagott|bassoon/i.test(s)) { canonical = 'Fagott'; }
  else if (/violin|viola/i.test(s)) { canonical = 'Violin'; }
  else if (/cello/i.test(s)) { canonical = 'Cello'; }
  else if (/eufonium|euphonium/i.test(s)) { canonical = 'Eufonium'; }

  const result = canonical || s;
  const qualStr = qualifiers.length > 0 ? ' ' + qualifiers.join(' ') : '';
  return (result + qualStr).trim();
}

// ─── Recording filename parsing ───────────────────────────────────────────────

const UNKNOWN_DATE_RE = /ok[äa]nt|unknown/i;

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRecordingFilename(filename, songFolderName) {
  const noExt = path.basename(filename, path.extname(filename));

  // Build candidate prefixes to strip
  const prefixCandidates = [
    sanitize(songFolderName),
    sanitize(songFolderName.replace(/_/g, ' ')),
    songFolderName,
  ].filter(Boolean);

  let remainder = noExt;
  for (const prefix of prefixCandidates) {
    // Also match optional _nr\d suffix: SongName_nr1-Album-date
    const re = new RegExp('^' + escapeRe(prefix) + '(?:_nr\\d+)?', 'i');
    if (re.test(noExt)) {
      remainder = noExt.replace(re, '').replace(/^[-_\s]+/, '');
      break;
    }
  }

  let album = null;
  let date = null;

  // Normalize underscore-prefixed dates at end: rep_2025-01-19 → rep--2025-01-19
  remainder = remainder.replace(/_(\d{4}(?:-\d{2}(?:-\d{2})?)?)$/, '--$1');

  // Try double-dash separator: ...Album--Date
  const ddIdx = remainder.indexOf('--');
  if (ddIdx !== -1) {
    const afterDD = remainder.slice(ddIdx + 2);
    const beforeDD = remainder.slice(0, ddIdx);
    const dateMatch = afterDD.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?)/);
    if (dateMatch) {
      date = dateMatch[1];
      album = beforeDD.replace(/^[-_]+|[-_]+$/g, '').replace(/_/g, ' ') || null;
    } else if (UNKNOWN_DATE_RE.test(afterDD)) {
      album = beforeDD.replace(/^[-_]+|[-_]+$/g, '').replace(/_/g, ' ') || null;
    } else {
      album = remainder.replace(/_/g, ' ') || null;
    }
  } else {
    // Check for year glued to album name with no separator (e.g., LjudOBild1987)
    const embeddedYear = !remainder.includes('-') ? remainder.match(/^(.+?)(\d{4})$/) : null;
    if (embeddedYear) {
      date  = embeddedYear[2];
      album = embeddedYear[1].replace(/[_\-]+$/, '').replace(/_/g, ' ').trim() || null;
    } else {
      // Try trailing year: ...Album-YYYY or ...Album-YYYY-MM-DD
      const parts = remainder.split('-');
      let dateIdx = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{4}$/.test(parts[i])) { dateIdx = i; break; }
      }
      if (dateIdx !== -1) {
        const dateStr = parts.slice(dateIdx).join('-');
        const dateMatch = dateStr.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?)/);
        date = dateMatch ? dateMatch[1] : null;
        album = parts.slice(0, dateIdx).join('-').replace(/^[-_]+|[-_]+$/g, '').replace(/_/g, ' ') || null;
      } else if (UNKNOWN_DATE_RE.test(remainder)) {
        const cleaned = remainder.replace(/-?ok[äa]nt[_\s]*datum/i, '').replace(/_/g, ' ').trim();
        album = cleaned || null;
      } else {
        album = remainder.replace(/_/g, ' ').trim() || null;
      }
    }
  }

  if (album) album = normalizeAlbum(album.trim()) || null;
  if (album && !date && ALBUM_YEARS[album]) date = ALBUM_YEARS[album];
  return { album, date };
}

// ─── Album name normalization ─────────────────────────────────────────────────

const ALBUM_YEARS = {
  'LiTHe Blås 50 år':         '2016',
  'LiTHe Blås 45 år':         '2011',
  'LiTHe Blås 25 år':         '1991',
  'LiTHe Blås 20 år':         '1986',
  'LiTHe Blås Femårskonsert': '1971',
  'Luciafesten 96':            '1996',
};

function normalizeAlbum(raw) {
  if (!raw || !raw.trim()) return raw;
  const s = raw.trim();

  // Anniversary albums (check most recent/specific first)
  if (/50\s*[åa]r/i.test(s))                         return 'LiTHe Blås 50 år';
  if (/45\s*[åa]r/i.test(s))                         return 'LiTHe Blås 45 år';
  if (/25\s*[åa]r/i.test(s))                         return 'LiTHe Blås 25 år';
  if (/20\s*[åa]r/i.test(s))                         return 'LiTHe Blås 20 år';
  if (/fem[åa]rs|fem[åa]rskonsert|\b5\s*[åa]rs/i.test(s)) return 'LiTHe Blås Femårskonsert';

  // Named studio/live albums
  if (/stj[äa]lper|stor\s*jazz/i.test(s))            return 'LiTHe Blås stjälper ofta stor jazz';
  if (/kaffe/i.test(s))                              return 'LiTHe Blås spelar en skiva till kaffet';
  if (/buss?kul.*extra|buss?kultur.*extra/i.test(s)) return 'Bus(s)kultur Extra';
  if (/buss?kul|buss?kultur/i.test(s))               return 'Bus(s)kultur med LiTHe Blås';
  if (/rock(ar)?\b/i.test(s))                        return 'Blåset(s) Rockar';
  if (/smusk|power\s*board/i.test(s))                return 'LiTHe Blås, SmuSK och Power Board Stompers';
  if (/arkiv|bildskiva|ljud.*bild/i.test(s))          return 'Ljud- & Bildskiva För Arkivering';
  if (/styv\s*kul|kalla\s*den/i.test(s))             return 'Styv Kuling ... Eller Kalla Den Vad Du Vill';
  if (/the\s*record/i.test(s))                       return 'LiTHe Blås - The Record';
  if (/\bsof\b|norr?k[öo]ping/i.test(s))             return 'Konsert SOF Norrköping';
  if (/lucia/i.test(s))                              return 'Luciafesten 96';
  if (/\brep\b|repetition/i.test(s))                 return 'Repetition';
  if (/sing[\s_-]*a[\s_-]*long|singalong/i.test(s))  return 'Sing a long';

  return s; // keep as-is if no match
}

// ─── Sheet music instrument extraction ───────────────────────────────────────

function extractInstrument(filename, songFolderName) {
  // Strip Windows duplicate-file suffix before any processing
  const noExt = path.basename(filename, path.extname(filename))
    .replace(/\s*\(\d+\)\s*$/, '');

  const prefixCandidates = [
    sanitize(songFolderName),
    sanitize(songFolderName.replace(/_/g, ' ')),
    songFolderName.replace(/_/g, ' '),
    songFolderName,
  ].filter(Boolean);

  let remainder = noExt;
  for (const prefix of prefixCandidates) {
    if (!prefix) continue;
    const re = new RegExp('^' + escapeRe(prefix), 'i');
    if (re.test(noExt)) {
      remainder = noExt.replace(re, '').replace(/^[-_\s,;.]+/, '').trim();
      break;
    }
  }

  // If prefix stripping failed, try splitting on ' - ' separator (e.g. "I Saw Mama - fl1")
  if (remainder === noExt) {
    const dashIdx = noExt.lastIndexOf(' - ');
    if (dashIdx !== -1) remainder = noExt.slice(dashIdx + 3).trim();
  }

  // Strip version tags left after prefix removal: v3, ver2, 4.0-, etc.
  remainder = remainder.replace(/^v(?:er)?\s*\d+[\s_-]*/i, '');
  remainder = remainder.replace(/^\d+\.\d+[-_\s]+/, '');

  if (!remainder || remainder.length < 2) remainder = noExt;
  return normalizeInstrument(remainder.replace(/_/g, ' '));
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

const stmtInsertSong   = db.prepare(`INSERT OR IGNORE INTO songs (name, description, type, status) VALUES (@name, '', '', '')`);
const stmtGetSong      = db.prepare(`SELECT id FROM songs WHERE name = ?`);
const stmtInsertColl   = db.prepare(`INSERT OR IGNORE INTO collections (song_id, asset_type, name) VALUES (@song_id, @asset_type, @name)`);
const stmtGetColl      = db.prepare(`SELECT id FROM collections WHERE song_id = ? AND asset_type = ? AND name = ?`);
const stmtInsertFile   = db.prepare(`INSERT INTO files (song_id, collection_id, asset_type, file_path, name, date, album, instrument) VALUES (@song_id, @collection_id, @asset_type, @file_path, @name, @date, @album, @instrument)`);
const stmtFileByPath   = db.prepare(`SELECT id FROM files WHERE file_path = ?`);

function getOrCreateSong(songName) {
  let row = stmtGetSong.get(songName);
  if (!row) {
    if (!DRY_RUN) {
      stmtInsertSong.run({ name: songName });
      row = stmtGetSong.get(songName);
    } else {
      row = { id: -1 };
    }
    stats.songs++;
    console.log(`  + SONG "${songName}"`);
  }
  return row ? row.id : null;
}

function getOrCreateCollection(songId, assetType, collName) {
  let row = stmtGetColl.get(songId, assetType, collName);
  if (!row) {
    if (!DRY_RUN && songId > 0) {
      stmtInsertColl.run({ song_id: songId, asset_type: assetType, name: collName });
      row = stmtGetColl.get(songId, assetType, collName);
    } else {
      row = { id: -1 };
    }
  }
  return row ? row.id : null;
}

// ─── Core import function ─────────────────────────────────────────────────────

const ASSET_FOLDERS_MAP = { recordings: 'recordings', sheetMusic: 'sheet_music', lyrics: 'lyrics', otherFiles: 'other' };

const stats = { songs: 0, files: 0, skipped: 0, errors: 0 };

function importFile(srcPath, songName, songId, assetType, fileObj, collectionName) {
  const ext = path.extname(srcPath);

  // Compute target dir
  let targetDir;
  if (DRY_RUN) {
    const folder = ASSET_FOLDERS_MAP[assetType] || 'other';
    targetDir = path.join(getUploadsBase(), 'songs', sanitize(songName) || 'Song', folder);
  } else {
    targetDir = getSongAssetDir(songName, assetType);
  }

  const filename = constructFileName(songName, fileObj, assetType, ext, collectionName);
  let targetPath = path.join(targetDir, filename);
  if (!DRY_RUN) targetPath = resolveUniqueFilePath(targetPath);

  const relPath = toRelativePath(targetPath);

  // Skip if already imported
  if (!DRY_RUN) {
    if (stmtFileByPath.get(relPath)) { stats.skipped++; return; }
  }

  let collId = null;
  if (collectionName) {
    collId = getOrCreateCollection(songId, assetType, collectionName);
  }

  if (DRY_RUN) {
    console.log(`    [DRY] ${path.basename(srcPath)}  ->  ${relPath}`);
  } else {
    fs.copyFileSync(srcPath, targetPath);
    stmtInsertFile.run({
      song_id: songId,
      collection_id: collId,
      asset_type: assetType,
      file_path: relPath,
      name:       fileObj.name       || '',
      date:       fileObj.date       || '',
      album:      fileObj.album      || '',
      instrument: fileObj.instrument || '',
    });
    console.log(`    COPY  ${path.basename(srcPath)}  ->  ${relPath}`);
  }
  stats.files++;
}

// ─── Type-specific wrappers ───────────────────────────────────────────────────

function doRecording(srcPath, songName, songId, songFolderName, collName) {
  const { album, date } = parseRecordingFilename(path.basename(srcPath), songFolderName);
  importFile(srcPath, songName, songId, 'recordings',
    { name: album || path.basename(srcPath, path.extname(srcPath)), album: album || '', date: date || '' },
    collName);
}

function doSheet(srcPath, songName, songId, songFolderName, collName) {
  const instrument = extractInstrument(path.basename(srcPath), songFolderName);
  importFile(srcPath, songName, songId, 'sheetMusic',
    { name: instrument, instrument },
    collName);
}

function doLyric(srcPath, songName, songId) {
  const name = path.basename(srcPath, path.extname(srcPath)).replace(/[_]/g, ' ');
  importFile(srcPath, songName, songId, 'lyrics', { name }, null);
}

function doOther(srcPath, songName, songId, prefix) {
  const name = (prefix || '') + path.basename(srcPath, path.extname(srcPath)).replace(/[_]/g, ' ');
  importFile(srcPath, songName, songId, 'otherFiles', { name }, null);
}

// ─── Directory walkers ────────────────────────────────────────────────────────

/**
 * Walk a directory and dispatch each file to the right import handler.
 * collectionName = null means "not in a collection".
 * Once a collection is set (entering a first-level subdir), it is passed to
 * all deeper levels unchanged.
 */
function walkNotesDir(dir, songName, songId, songFolderName, collectionName) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { console.warn(`    WARN cannot read ${dir}: ${e.message}`); return; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // First level subdir → becomes the collection; deeper → inherit
      const newColl = collectionName !== null ? collectionName : entry.name.replace(/_/g, ' ');
      walkNotesDir(fullPath, songName, songId, songFolderName, newColl);
      continue;
    }

    const ext = path.extname(entry.name);
    if (shouldSkip(ext)) continue;

    if (isAudioVideo(ext)) {
      doRecording(fullPath, songName, songId, songFolderName, collectionName);
    } else if (SCORE_EXTS.has(ext.toLowerCase()) || IMAGE_EXTS.has(ext.toLowerCase())) {
      doOther(fullPath, songName, songId, '');
    } else {
      // pdf, txt → sheet music
      doSheet(fullPath, songName, songId, songFolderName, collectionName);
    }
  }
}

function walkDansDir(dir, songName, songId) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    const ext = path.extname(entry.name);
    if (shouldSkip(ext)) continue;
    doOther(fullPath, songName, songId, 'Dans: ');
  }
}

function walkInspelningarDir(dir, songName, songId, songFolderName) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    const ext = path.extname(entry.name);
    if (shouldSkip(ext)) continue;

    if (isAudioVideo(ext)) {
      doRecording(fullPath, songName, songId, songFolderName, null);
    } else if (ext.toLowerCase() === '.pdf') {
      // Rare: PDF in Inspelningar (e.g. program notes) → otherFiles
      doOther(fullPath, songName, songId, '');
    } else {
      doOther(fullPath, songName, songId, '');
    }
  }
}

// ─── Song folder processor ────────────────────────────────────────────────────

function importSongFolder(songDir, folderName) {
  const songName = folderName.replace(/_/g, ' ');
  console.log(`\n[${folderName}]  →  "${songName}"`);

  const songId = getOrCreateSong(songName);
  if (!songId && !DRY_RUN) return;

  let entries;
  try { entries = fs.readdirSync(songDir, { withFileTypes: true }); }
  catch (e) { console.error(`  ERROR reading ${songDir}: ${e.message}`); stats.errors++; return; }

  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  const files   = entries.filter(e => !e.isDirectory());

  // Known subfolders
  for (const sub of subdirs) {
    const subPath = path.join(songDir, sub);
    if (/^inspelning/i.test(sub)) {
      walkInspelningarDir(subPath, songName, songId, folderName);
    } else if (/^noter$/i.test(sub)) {
      walkNotesDir(subPath, songName, songId, folderName, null);
    } else if (/^dans$/i.test(sub)) {
      walkDansDir(subPath, songName, songId);
    } else if (/^stämmor$|^stammor$/i.test(sub)) {
      // Some songs have a "Stämmor" folder instead of "Noter"
      walkNotesDir(subPath, songName, songId, folderName, null);
    }
    // Other subfolders (e.g. loose custom dirs) are caught via walkNotesDir
    // if they were inside a "Noter" dir; otherwise ignored.
  }

  // Root-level files
  for (const file of files) {
    const ext = path.extname(file.name);
    if (shouldSkip(ext)) continue;
    const srcPath = path.join(songDir, file.name);

    if (ext.toLowerCase() === '.txt' || isLyricFile(file.name)) {
      doLyric(srcPath, songName, songId);
    } else if (isAudioVideo(ext)) {
      doRecording(srcPath, songName, songId, folderName, null);
    } else if (ext.toLowerCase() === '.pdf') {
      if (isLyricFile(file.name)) {
        doLyric(srcPath, songName, songId);
      } else {
        doSheet(srcPath, songName, songId, folderName, null);
      }
    } else if (SCORE_EXTS.has(ext.toLowerCase()) || IMAGE_EXTS.has(ext.toLowerCase())) {
      doOther(srcPath, songName, songId, '');
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log(`LiTHe Blas bulk import`);
console.log(`Source : ${SOURCE_DIR}`);
console.log(`Mode   : ${DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'}`);
console.log('='.repeat(60));

const songFolders = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

console.log(`Found ${songFolders.length} song folders.\n`);

for (const folderName of songFolders) {
  try {
    importSongFolder(path.join(SOURCE_DIR, folderName), folderName);
  } catch (err) {
    console.error(`  ERROR in ${folderName}: ${err.message}`);
    stats.errors++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Import ${DRY_RUN ? '(dry run) ' : ''}complete`);
console.log(`  Songs created : ${stats.songs}`);
console.log(`  Files copied  : ${stats.files}`);
console.log(`  Skipped       : ${stats.skipped}  (already in DB)`);
console.log(`  Errors        : ${stats.errors}`);
console.log('='.repeat(60));
