const express = require('express');
const router = express.Router();
const db = require('../database');
const { renameFileIfNeeded, renameSongFiles } = require('../fileUtils');

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
// Renames files on disk if metadata changed, then replaces all DB rows for this song
router.put('/:id', (req, res) => {
  const songId = parseInt(req.params.id);
  const { name, description, type, status, recordings, sheetMusic, lyrics, otherFiles } = req.body;

  const saveTransaction = db.transaction(() => {
    // 1. Update basic song fields
    db.prepare(
      'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?'
    ).run(name || '', description || '', type || '', status || '', songId);

    // 2. Rename files on disk to reflect any metadata changes (including song name change)
    //    We do this BEFORE deleting DB rows so we still have asset_type info
    const allAssets = [
      ...(recordings || []),
      ...(sheetMusic || []),
      ...(lyrics || []),
      ...(otherFiles || [])
    ];

    // Flatten to individual file objects with their asset_type attached
    const allFiles = allAssets.flatMap(item => {
      if (Array.isArray(item.parts)) {
        return item.parts.map(p => ({ ...p, asset_type: item.asset_type || p.asset_type }));
      }
      return [item];
    });

    // Rename each file on disk, collect updated paths
    const renamedPaths = {};
    for (const file of allFiles) {
      if (file.file_path) {
        const newPath = renameFileIfNeeded(file.file_path, name, file, file.asset_type);
        renamedPaths[file.file_path] = newPath;
      }
    }

    // 3. Delete all existing collections and files for this song
    db.prepare('DELETE FROM collections WHERE song_id = ?').run(songId);
    db.prepare('DELETE FROM files WHERE song_id = ?').run(songId);

    // 4. Re-insert everything with updated paths
    const assetMap = {
      recordings: recordings || [],
      sheetMusic: sheetMusic || [],
      lyrics: lyrics || [],
      otherFiles: otherFiles || []
    };

    for (const [assetType, items] of Object.entries(assetMap)) {
      for (const item of items) {
        if (Array.isArray(item.parts)) {
          // Insert collection row
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

// DELETE a song (DB cascades to collections and files rows)
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /songs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
