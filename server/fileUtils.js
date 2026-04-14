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
 * Pattern: {song_name}-{collection_name}-{key_metadata}--{date}.{ext}
 * collection_name is omitted when the file is not part of a collection.
 * Falls back gracefully if fields are missing.
 */
const constructFileName = (songName, fileObj, assetType, originalExt, collectionName) => {
  const base = sanitize(songName) || 'Song';
  const collPart = collectionName ? `-${sanitize(collectionName)}` : '';

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

  return `${base}${collPart}-${detail}${datePart}${ext}`;
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
 * songName is sanitized and used as the folder name under songs/.
 */
const getSongAssetDir = (songName, assetType) => {
  const folder = ASSET_FOLDERS[assetType] || 'other';
  const safeName = sanitize(songName) || 'Song';
  const dir = path.join(getUploadsBase(), 'songs', safeName, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Rename the top-level song directory from oldDirName to newDirName
 * (both are plain directory names, not full paths).
 * Handles migrations from the old numeric ID format to a name-based format.
 *
 * Returns an object mapping every affected old relative path to its new
 * relative path, or an empty object when no rename happened.
 */
const renameSongDir = (oldDirName, newDirName) => {
  if (!oldDirName || !newDirName || oldDirName === newDirName) return {};

  const oldAbsDir = path.join(getUploadsBase(), 'songs', oldDirName);
  const newAbsDir = path.join(getUploadsBase(), 'songs', newDirName);

  if (!fs.existsSync(oldAbsDir)) return {};
  // If the target already exists we can't rename cleanly — leave everything in place.
  if (fs.existsSync(newAbsDir)) return {};

  fs.renameSync(oldAbsDir, newAbsDir);

  // Walk the moved directory and build { oldRelPath: newRelPath } for every file.
  const updates = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const newRel = toRelativePath(fullPath);
        // Replace the new dir name segment with the old one to reconstruct the old path.
        const oldRel = 'songs/' + oldDirName + '/' + newRel.slice(('songs/' + newDirName + '/').length);
        updates[oldRel] = newRel;
      }
    }
  };
  walk(newAbsDir);

  return updates;
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
 * Rename all individual files within a song folder to reflect a new song name.
 * Called after updating song fields but before re-inserting files in the DB.
 * Returns the array of files with updated file_paths.
 */
const renameSongFiles = (newSongName, allFiles) => {
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
const renameFileIfNeeded = (currentRelativePath, songName, fileObj, assetType, collectionName) => {
  if (!currentRelativePath) return currentRelativePath;

  const currentAbsolute = toAbsolutePath(currentRelativePath);
  if (!fs.existsSync(currentAbsolute)) return currentRelativePath;

  const ext = path.extname(currentRelativePath);
  const dir = path.dirname(currentAbsolute);

  const newFileName = constructFileName(songName, fileObj, assetType, ext, collectionName);
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
  sanitize,
  constructFileName,
  resolveUniqueFilePath,
  getSongAssetDir,
  renameSongDir,
  toRelativePath,
  toAbsolutePath,
  renameFileIfNeeded,
  renameSongFiles,
  getUploadsBase
};
