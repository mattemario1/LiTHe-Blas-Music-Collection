const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { sanitize, toRelativePath, getUploadsBase } = require('../fileUtils');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/albums
// Returns all albums derived from recording metadata, with cover and songs
router.get('/', (req, res) => {
  try {
    const albumNames = db.prepare(`
      SELECT DISTINCT album FROM files
      WHERE asset_type = 'recordings' AND album != ''
      ORDER BY album
    `).all().map(r => r.album);

    const albums = albumNames.map(albumName => {
      const meta = db.prepare('SELECT * FROM albums WHERE name = ?').get(albumName) || {};

      const recordings = db.prepare(`
        SELECT f.id, f.file_path, f.date, f.song_id, s.name AS song_name
        FROM files f
        JOIN songs s ON f.song_id = s.id
        WHERE f.asset_type = 'recordings' AND f.album = ?
        ORDER BY s.name
      `).all(albumName);

      // Group recordings by song
      const songMap = new Map();
      for (const rec of recordings) {
        if (!songMap.has(rec.song_id)) {
          songMap.set(rec.song_id, {
            song_id: rec.song_id,
            song_name: rec.song_name,
            recordings: []
          });
        }
        songMap.get(rec.song_id).recordings.push({
          id: rec.id,
          file_path: rec.file_path,
          date: rec.date
        });
      }

      return {
        id: meta.id || null,
        name: albumName,
        cover_path: meta.cover_path || '',
        description: meta.description || '',
        year: meta.year || '',
        songs: Array.from(songMap.values())
      };
    });

    res.json(albums);
  } catch (err) {
    console.error('GET /albums error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/albums/:name — upsert album metadata (description, year)
router.put('/:name', (req, res) => {
  try {
    const albumName = decodeURIComponent(req.params.name);
    const { description, year } = req.body;

    const existing = db.prepare('SELECT * FROM albums WHERE name = ?').get(albumName);
    if (existing) {
      db.prepare('UPDATE albums SET description = ?, year = ? WHERE name = ?')
        .run(description || '', year || '', albumName);
    } else {
      db.prepare('INSERT INTO albums (name, description, year) VALUES (?, ?, ?)')
        .run(albumName, description || '', year || '');
    }

    res.json(db.prepare('SELECT * FROM albums WHERE name = ?').get(albumName));
  } catch (err) {
    console.error('PUT /albums/:name error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/albums/:name/cover — upload a cover image for an album
router.post('/:name/cover', upload.single('file'), (req, res) => {
  try {
    const albumName = decodeURIComponent(req.params.name);

    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const dir = path.join(getUploadsBase(), 'albums', sanitize(albumName));
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(req.file.originalname);
    const targetPath = path.join(dir, `cover${ext}`);
    fs.writeFileSync(targetPath, req.file.buffer);

    const relativePath = toRelativePath(targetPath);

    const existing = db.prepare('SELECT * FROM albums WHERE name = ?').get(albumName);
    if (existing) {
      db.prepare('UPDATE albums SET cover_path = ? WHERE name = ?').run(relativePath, albumName);
    } else {
      db.prepare('INSERT INTO albums (name, cover_path) VALUES (?, ?)').run(albumName, relativePath);
    }

    res.json({ coverPath: relativePath });
  } catch (err) {
    console.error('POST /albums/:name/cover error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
