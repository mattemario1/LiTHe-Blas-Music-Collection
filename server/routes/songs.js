const express = require('express');
const fs = require('fs');
const router = express.Router();
const db = require('../database');
const { sanitize, renameFileIfNeeded, renameSongDir, toAbsolutePath } = require('../fileUtils');

/**
 * Apply a { oldPath: newPath } dict to every file_path in an assetMap.
 * Returns a new assetMap; entries with no match are left unchanged.
 */
const applyPathUpdates = (assetMap, updates) => {
  if (Object.keys(updates).length === 0) return assetMap;
  const upd = (fp) => (fp && updates[fp]) ? updates[fp] : fp;
  const result = {};
  for (const [assetType, items] of Object.entries(assetMap)) {
    result[assetType] = items.map(item => {
      if (Array.isArray(item.parts)) {
        return { ...item, parts: item.parts.map(p => ({ ...p, file_path: upd(p.file_path) })) };
      }
      return { ...item, file_path: upd(item.file_path) };
    });
  }
  return result;
};

/**
 * Helper: read a full song from the database including all its
 * collections and files, structured the way the frontend expects.
 */
const getSongById = (id) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  if (!song) return null;

  const collections = db.prepare('SELECT * FROM collections WHERE song_id = ?').all(id);
  const allFiles = db.prepare('SELECT * FROM files WHERE song_id = ?').all(id);

  const assetTypes = ['recordings', 'sheetMusic', 'lyrics', 'otherFiles'];

  for (const assetType of assetTypes) {
    const assetCollections = collections
      .filter(c => c.asset_type === assetType)
      .map(c => ({
        id: c.id,
        name: c.name,
        parts: allFiles.filter(f => f.collection_id === c.id)
      }));

    const ungrouped = allFiles.filter(
      f => f.asset_type === assetType && f.collection_id === null
    );

    song[assetType] = [...assetCollections, ...ungrouped];
  }

  return song;
};

// GET all songs with full assets (needed for album filter etc)
router.get('/', (req, res) => {
  try {
    const songs = db.prepare('SELECT * FROM songs ORDER BY name').all();
    const fullSongs = songs.map(s => getSongById(s.id));
    res.json(fullSongs);
  } catch (err) {
    console.error('GET /songs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET a single song with all assets
router.get('/:id', (req, res) => {
  try {
    const song = getSongById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (err) {
    console.error('GET /songs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create a new empty song
router.post('/', (req, res) => {
  try {
    const { name = '', description = '', type = '', status = '' } = req.body;
    const result = db.prepare(
      'INSERT INTO songs (name, description, type, status) VALUES (?, ?, ?, ?)'
    ).run(name, description, type, status);

    const newSong = getSongById(result.lastInsertRowid);
    res.status(201).json(newSong);
  } catch (err) {
    console.error('POST /songs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT save a complete song
// Renames files on disk if metadata changed, deletes removed files, then replaces all DB rows
router.put('/:id', (req, res) => {
  const songId = parseInt(req.params.id);
  const { name, description, type, status, recordings, sheetMusic, lyrics, otherFiles } = req.body;

  const assetMap = {
    recordings: recordings || [],
    sheetMusic: sheetMusic || [],
    lyrics: lyrics || [],
    otherFiles: otherFiles || []
  };

  const saveTransaction = db.transaction(() => {
    // 1. Snapshot current DB file paths before any changes (needed for deletion detection)
    const existingFiles = db.prepare('SELECT file_path FROM files WHERE song_id = ?').all(songId);
    const existingDbPaths = new Set(existingFiles.map(f => f.file_path).filter(Boolean));

    // 2. Update basic song fields
    db.prepare(
      'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?'
    ).run(name || '', description || '', type || '', status || '', songId);

    // 3. Rename the song's top-level directory if the name changed (or migrate from old ID-based dir).
    //    We detect the current dir name from an existing file path (works for both formats).
    const newDirName = sanitize(name || '') || 'Song';
    const firstExisting = existingFiles.find(f => f.file_path);
    let workingAssetMap = assetMap;
    let workingExistingPaths = existingDbPaths;

    if (firstExisting) {
      const currentDirName = firstExisting.file_path.split('/')[1];
      if (currentDirName !== newDirName) {
        const dirUpdates = renameSongDir(currentDirName, newDirName);
        if (Object.keys(dirUpdates).length > 0) {
          // Remap file paths in both the incoming request and the existing-path snapshot
          workingAssetMap = applyPathUpdates(assetMap, dirUpdates);
          workingExistingPaths = new Set(
            [...existingDbPaths].map(p => dirUpdates[p] || p)
          );
        }
      }
    }

    // 4. Rename individual files on disk to reflect metadata changes.
    //    Iterate over workingAssetMap directly so each file has the correct assetType —
    //    file objects from the frontend may not carry an asset_type field.
    const renamedPaths = {};
    for (const [assetType, items] of Object.entries(workingAssetMap)) {
      for (const item of items) {
        if (Array.isArray(item.parts)) {
          for (const part of item.parts) {
            if (part.file_path) {
              const newPath = renameFileIfNeeded(part.file_path, name, part, assetType, item.name);
              renamedPaths[part.file_path] = newPath;
            }
          }
        } else {
          if (item.file_path) {
            const newPath = renameFileIfNeeded(item.file_path, name, item, assetType);
            renamedPaths[item.file_path] = newPath;
          }
        }
      }
    }

    // 5. Delete physical files that are no longer in the new request
    for (const existingPath of workingExistingPaths) {
      if (!Object.prototype.hasOwnProperty.call(renamedPaths, existingPath)) {
        const absPath = toAbsolutePath(existingPath);
        if (fs.existsSync(absPath)) {
          try { fs.unlinkSync(absPath); } catch (_) { /* ignore */ }
        }
      }
    }

    // 6. Delete all existing collections and files for this song (DB rows)
    db.prepare('DELETE FROM collections WHERE song_id = ?').run(songId);
    db.prepare('DELETE FROM files WHERE song_id = ?').run(songId);

    // 7. Re-insert everything with updated paths
    for (const [assetType, items] of Object.entries(workingAssetMap)) {
      for (const item of items) {
        if (Array.isArray(item.parts)) {
          const collResult = db.prepare(
            'INSERT INTO collections (song_id, asset_type, name) VALUES (?, ?, ?)'
          ).run(songId, assetType, item.name || '');

          const collectionId = collResult.lastInsertRowid;

          for (const part of item.parts) {
            const finalPath = renamedPaths[part.file_path] || part.file_path || '';
            db.prepare(`
              INSERT INTO files
                (song_id, collection_id, asset_type, file_path, name, description, date, album, instrument, duration)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              songId, collectionId, assetType, finalPath,
              part.name || '', part.description || '', part.date || '',
              part.album || '', part.instrument || '', part.duration || 0
            );
          }
        } else {
          const finalPath = renamedPaths[item.file_path] || item.file_path || '';
          db.prepare(`
            INSERT INTO files
              (song_id, collection_id, asset_type, file_path, name, description, date, album, instrument, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            songId, null, assetType, finalPath,
            item.name || '', item.description || '', item.date || '',
            item.album || '', item.instrument || '', item.duration || 0
          );
        }
      }
    }
  });

  try {
    saveTransaction();
    const updatedSong = getSongById(songId);
    res.json(updatedSong);
  } catch (err) {
    console.error('PUT /songs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a song — removes DB rows and all physical files on disk
router.delete('/:id', (req, res) => {
  try {
    const files = db.prepare('SELECT file_path FROM files WHERE song_id = ?').all(req.params.id);
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);

    for (const file of files) {
      if (file.file_path) {
        const absPath = toAbsolutePath(file.file_path);
        if (fs.existsSync(absPath)) {
          try { fs.unlinkSync(absPath); } catch (_) { /* ignore */ }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /songs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
