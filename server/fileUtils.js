const fs = require('fs');
const path = require('path');

// Use UPLOADS_DIR env var if set (from docker-compose), otherwise default to local uploads folder
const getUploadsBase = () => process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

// Map asset types to folder names on disk
const ASSET_FOLDERS = {
  recordings: 'recordings',
  sheetMusic: 'sheet_music',
  lyrics: 'lyrics',
  otherFiles: 'other'
};

// Replace characters that are unsafe in filenames
const sanitize = (str) => {
  if (!str) return '';
  return str
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .normalize('NFC');
};

/**
 * Construct a human-readable filename from song and file metadata.
 * Pattern: {song_name}-{key_metadata}--{date}.{ext}
 * Falls back gracefully if fields are missing.
 */
const constructFileName = (songName, fileObj, assetType, originalExt) => {
  const base = sanitize(songName) || 'Song';

  let detail = '';
  switch (assetType) {
    case 'recordings':
      detail = sanitize(fileObj.album) || sanitize(fileObj.name) || 'Recording';
      break;
    case 'sheetMusic':
      detail = sanitize(fileObj.instrument) || sanitize(fileObj.name) || 'Sheet';
      break;
    case 'lyrics':
      detail = sanitize(fileObj.name) || 'Lyrics';
      break;
    case 'otherFiles':
      detail = sanitize(fileObj.name) || 'File';
      break;
    default:
      detail = sanitize(fileObj.name) || 'File';
  }

  const datePart = fileObj.date ? `--${sanitize(fileObj.date)}` : '';
  const ext = originalExt.startsWith('.') ? originalExt : `.${originalExt}`;

  return `${base}-${detail}${datePart}${ext}`;
};

/**
 * If a file already exists at the target path, append _1, _2 etc until unique.
 */
const resolveUniqueFilePath = (targetPath) => {
  if (!fs.existsSync(targetPath)) return targetPath;

  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);

  let counter = 1;
  let candidate;
  do {
    candidate = path.join(dir, `${base}_${counter}${ext}`);
    counter++;
  } while (fs.existsSync(candidate));

  return candidate;
};

/**
 * Get the full directory path for a song's asset type.
 * Creates the directory if it doesn't exist.
 */
const getSongAssetDir = (songId, assetType) => {
  const folder = ASSET_FOLDERS[assetType] || 'other';
  const dir = path.join(getUploadsBase(), 'songs', String(songId), folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Convert an absolute path to a relative storage path (what gets stored in DB).
 * e.g. /app/server/uploads/songs/42/recordings/foo.mp3 -> songs/42/recordings/foo.mp3
 */
const toRelativePath = (absolutePath) => {
  return path.relative(getUploadsBase(), absolutePath);
};

/**
 * Convert a relative storage path back to an absolute path.
 */
const toAbsolutePath = (relativePath) => {
  return path.join(getUploadsBase(), relativePath);
};

/**
 * Rename the song's folder on disk when the song name changes.
 * Since files are stored in songs/{id}/..., the song name is only part of
 * individual filenames — but this renames all files within the song folder
 * to reflect the new song name.
 * 
 * This is called from the save route after updating song fields but before
 * reinserting files, so we return updated file_paths for the DB.
 */
const renameSongFiles = (songId, newSongName, allFiles) => {
  // Go through every file, reconstruct what its name should be now,
  // and rename on disk if different
  return allFiles.map(file => {
    if (!file.file_path) return file;

    const newPath = renameFileIfNeeded(file.file_path, newSongName, file, file.asset_type);
    return { ...file, file_path: newPath };
  });
};

/**
 * Rename a file on disk if the constructed name differs from the current name.
 * Returns the new relative file_path (or the old one if no rename was needed).
 */
const renameFileIfNeeded = (currentRelativePath, songName, fileObj, assetType) => {
  if (!currentRelativePath) return currentRelativePath;

  const currentAbsolute = toAbsolutePath(currentRelativePath);
  if (!fs.existsSync(currentAbsolute)) return currentRelativePath;

  const ext = path.extname(currentRelativePath);
  const dir = path.dirname(currentAbsolute);

  const newFileName = constructFileName(songName, fileObj, assetType, ext);
  const newAbsolute = path.join(dir, newFileName);

  // If the name is already correct, do nothing
  if (path.basename(currentAbsolute) === newFileName) {
    return currentRelativePath;
  }

  const uniqueAbsolute = resolveUniqueFilePath(newAbsolute);
  fs.renameSync(currentAbsolute, uniqueAbsolute);

  return toRelativePath(uniqueAbsolute);
};

module.exports = {
  constructFileName,
  resolveUniqueFilePath,
  getSongAssetDir,
  toRelativePath,
  toAbsolutePath,
  renameFileIfNeeded,
  renameSongFiles,
  getUploadsBase
};
