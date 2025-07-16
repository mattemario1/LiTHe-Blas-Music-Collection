const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configure paths using environment variables
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'songs.db');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

const db = new sqlite3.Database(DB_PATH);
const query = promisify(db.all).bind(db);
const run = promisify(db.run).bind(db);
const get = promisify(db.get).bind(db);

// Initialize database
async function initDB() {
  try {
    await run(`CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      status TEXT
    )`);

    await run(`CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER REFERENCES songs(id),
      name TEXT,
      asset_type TEXT NOT NULL,
      description TEXT
    )`);

    await run(`CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER REFERENCES songs(id),
      collection_id INTEGER REFERENCES collections(id),
      name TEXT,
      description TEXT,
      date TEXT,
      album TEXT,
      instrument TEXT,
      duration REAL,
      file_path TEXT NOT NULL,
      asset_type TEXT NOT NULL
    )`);
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

// Get all songs with nested data
app.get('/api/songs', async (req, res) => {
  try {
    console.log('Fetching all songs');
    const songs = await query('SELECT * FROM songs');
    
    for (const song of songs) {
      song.recordings = await getAssets(song.id, 'Recordings');
      song.sheetMusic = await getAssets(song.id, 'Sheet Music');
      song.lyrics = await getAssets(song.id, 'Lyrics');
      song.otherFiles = await getAssets(song.id, 'Other Files');
    }
    
    console.log(`Successfully fetched ${songs.length} songs`);
    res.json(songs);
  } catch (err) {
    console.error('Error in GET /api/songs:', err);
    res.status(500).json({ error: err.message });
  }
});

async function getAssets(songId, assetType) {
  try {
    console.log(`Fetching ${assetType} for song ${songId}`);
    const collections = await query(
      `SELECT c.*, 
        (SELECT json_group_array(json_object(
          'id', f.id,
          'name', f.name,
          'description', f.description,
          'date', f.date,
          'album', f.album,
          'instrument', f.instrument,
          'duration', f.duration,
          'file_path', f.file_path
        )) 
        FROM files f WHERE f.collection_id = c.id) as parts
      FROM collections c 
      WHERE c.song_id = ? AND c.asset_type = ?`,
      [songId, assetType]
    );

    // Parse the JSON parts
    collections.forEach(c => {
      c.parts = c.parts ? JSON.parse(c.parts) : [];
    });

    const ungroupedFiles = await query(
      'SELECT * FROM files WHERE song_id = ? AND asset_type = ? AND collection_id IS NULL',
      [songId, assetType]
    );

    return [...collections, ...ungroupedFiles];
  } catch (err) {
    console.error(`Error in getAssets for song ${songId}, type ${assetType}:`, err);
    throw err;
  }
}

// Get single song
app.get('/api/songs/:id', async (req, res) => {
  try {
    console.log(`Fetching song with ID ${req.params.id}`);
    const song = await get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    if (!song) {
      console.log(`Song not found with ID ${req.params.id}`);
      return res.status(404).json({ error: 'Song not found' });
    }

    song.recordings = await getAssets(song.id, 'Recordings');
    song.sheetMusic = await getAssets(song.id, 'Sheet Music');
    song.lyrics = await getAssets(song.id, 'Lyrics');
    song.otherFiles = await getAssets(song.id, 'Other Files');

    console.log(`Successfully fetched song ${song.id}: ${song.name}`);
    res.json(song);
  } catch (err) {
    console.error(`Error in GET /api/songs/${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Create/Update song
app.post('/api/songs', async (req, res) => {
  try {
    const { id, name, description, type, status } = req.body;
    console.log(`Processing song ${id ? 'update' : 'creation'} request`, { id, name });
    
    if (id) {
      // Update existing song
      await run(
        'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?',
        [name, description, type, status, id]
      );
      console.log(`Updated song ${id}`);
      res.json({ id });
    } else {
      // Create new song
      const songId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO songs (name, description, type, status) VALUES (?, ?, ?, ?)',
          [name, description || '', type || '', status || 'Active'],
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });
      
      // Create song directory
      const songDir = path.join(UPLOADS_DIR, `song_${songId}`);
      fs.mkdirSync(songDir, { recursive: true });
      console.log(`Created new song with ID ${songId} and directory ${songDir}`);
      
      res.json({ id: songId });
    }
  } catch (err) {
    console.error('Error in POST /api/songs:', err);
    res.status(500).json({ error: err.message });
  }
});

const preserveSpecialChars = (filename) => {
  // Only remove characters that are problematic for filesystems
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_') // Replace filesystem-illegal characters
    .normalize('NFC'); // Normalize to composed form (preserves å, ä, ö)
};

// File upload endpoint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.songId) {
      return res.status(400).json({ error: 'songId is required' });
    }
    const songId = parseInt(req.body.songId);
    if (isNaN(songId)) {
      return res.status(400).json({ error: 'songId must be a number' });
    }

    const { assetType, collectionName, collectionId, fileName, metadata } = req.body;
    if (!assetType) {
      return res.status(400).json({ error: 'assetType is required' });
    }

    const metadataObj = JSON.parse(metadata || '{}');
    
   // Preserve special characters in filename
    const originalName = req.file.originalname || 'file';
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const safeName = preserveSpecialChars((fileName || baseName) + ext);

    // Create directories with safe names
    const songDir = path.join(UPLOADS_DIR, `song_${songId}`);
    const assetDir = path.join(songDir, preserveSpecialChars(assetType.replace(/ /g, '_')));
    const finalDir = collectionName 
      ? path.join(assetDir, preserveSpecialChars(collectionName.replace(/ /g, '_'))) 
      : assetDir;

    fs.mkdirSync(finalDir, { recursive: true });
    const filePath = path.join(finalDir, safeName);

    // Write file from memory buffer
    fs.writeFileSync(filePath, req.file.buffer);
    
    // Get relative path for database storage
    const relativePath = path.relative(UPLOADS_DIR, filePath);

    // Database insertion
    if (collectionId) {
      await run(
        `INSERT INTO files (
          song_id, collection_id, name, description, date, 
          album, instrument, duration, file_path, asset_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          songId, collectionId, 
          metadataObj.name || '',
          metadataObj.description || '',
          metadataObj.date || '',
          metadataObj.album || '',
          metadataObj.instrument || '',
          metadataObj.duration || 0,
          relativePath,
          assetType
        ]
      );
      console.log(`Added file to existing collection ${collectionId}: ${relativePath}`);
    } else if (collectionName) {
      // Create new collection
      const collectionRes = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO collections (song_id, name, asset_type, description) VALUES (?, ?, ?, ?)',
          [songId, collectionName, assetType, metadataObj.description || ''],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      await run(
        `INSERT INTO files (
          song_id, collection_id, name, description, date,  
          album, instrument, duration, file_path, asset_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          songId, collectionRes, 
          metadataObj.name || '',
          metadataObj.description || '',
          metadataObj.date || '',
          metadataObj.album || '',
          metadataObj.instrument || '',
          metadataObj.duration || 0,
          relativePath,
          assetType
        ]
      );
      console.log(`Created new collection ${collectionRes} and added file: ${relativePath}`);
    } else {
      // Ungrouped file
      await run(
        `INSERT INTO files (
          song_id, name, description, date, 
          album, instrument, duration, file_path, asset_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          songId,
          metadataObj.name || '',
          metadataObj.description || '',
          metadataObj.date || '',
          metadataObj.album || '',
          metadataObj.instrument || '',
          metadataObj.duration || 0,
          relativePath,
          assetType
        ]
      );
      console.log(`Added ungrouped file: ${relativePath}`);
    }
    
    res.json({ success: true, filePath: relativePath });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/file/:filePath(*)', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filePath);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Update song endpoint
app.put('/api/songs/:id', async (req, res) => {
  try {
    const { name, description, type, status } = req.body;
    console.log(`Updating song ${req.params.id}`, { name, type, status });
    
    await run(
      'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?',
      [name, description, type, status, req.params.id]
    );
    
    console.log(`Successfully updated song ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Error in PUT /api/songs/${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Delete song endpoint
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    console.log(`Deleting song ${songId}`);
    
    // Delete from database
    await run('DELETE FROM songs WHERE id = ?', [songId]);
    await run('DELETE FROM files WHERE song_id = ?', [songId]);
    await run('DELETE FROM collections WHERE song_id = ?', [songId]);
    
    // Delete files
    const songDir = path.join(UPLOADS_DIR, `song_${songId}`);
    if (fs.existsSync(songDir)) {
      fs.rmSync(songDir, { recursive: true });
      console.log(`Deleted directory ${songDir}`);
    }
    
    console.log(`Successfully deleted song ${songId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Error in DELETE /api/songs/${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Batch delete files endpoint
app.post('/api/files/batch-delete', async (req, res) => {
  try {
    const { fileIds } = req.body;
    console.log(`Batch deleting files`, { fileIds });
    
    if (!Array.isArray(fileIds)) {
      return res.status(400).json({ error: 'fileIds must be an array' });
    }

    // Get the file paths to delete
    const placeholders = fileIds.map(() => '?').join(',');
    const files = await query(
      `SELECT file_path FROM files WHERE id IN (${placeholders})`, 
      fileIds
    );

    // Delete from database
    await run(`DELETE FROM files WHERE id IN (${placeholders})`, fileIds);
    
    // Delete from filesystem
    files.forEach(file => {
      const filePath = path.join(UPLOADS_DIR, file.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file ${filePath}`);
      }
    });
    
    console.log(`Successfully deleted ${files.length} files`);
    res.json({ message: 'Files deleted successfully.' });
  } catch (err) {
    console.error('Error during batch delete:', err);
    res.status(500).json({ error: 'Failed to delete files', details: err.message });
  }
});

// Initialize and start server
initDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database location: ${DB_PATH}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});