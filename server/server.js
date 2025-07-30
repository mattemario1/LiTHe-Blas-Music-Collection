const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',  // Vite dev server
    'http://192.168.0.84:8080',  // Production frontend
    'http://backend:5000'  // Docker internal
  ],
  credentials: true
}));

// Simplify CSP middleware
app.use((req, res, next) => {
  // Only set CSP for non-API routes
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/file')) {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "img-src 'self' data:; " +
      "script-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' http://localhost:5000 http://192.168.0.84:5000; " +
      "style-src 'self' 'unsafe-inline'"
    );
  }
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'API running' });
});

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
    console.log('[DB INIT] Initializing database tables...');
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
    console.log('[DB INIT] Database tables initialized successfully');
  } catch (err) {
    console.error('[DB INIT ERROR] Database initialization error:', err);
    throw err;
  }
}

// Get all songs with nested data
app.get('/api/songs', async (req, res) => {
  try {
    console.log('[GET SONGS] Fetching all songs with nested data');
    const songs = await query('SELECT * FROM songs');
    
    for (const song of songs) {
      console.log(`[GET SONGS] Loading assets for song ${song.id}: ${song.name}`);
      song.recordings = await getAssets(song.id, 'Recordings');
      song.sheetMusic = await getAssets(song.id, 'Sheet Music');
      song.lyrics = await getAssets(song.id, 'Lyrics');
      song.otherFiles = await getAssets(song.id, 'Other Files');
    }
    
    console.log(`[GET SONGS] Successfully fetched ${songs.length} songs`);
    res.json(songs);
  } catch (err) {
    console.error('[GET SONGS ERROR] Error fetching songs:', err);
    res.status(500).json({ error: err.message });
  }
});

async function getAssets(songId, assetType) {
  try {
    console.log(`[GET ASSETS] Fetching ${assetType} for song ${songId}`);
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
      console.log(`[GET ASSETS] Loaded collection ${c.id} with ${c.parts.length} files`);
    });

    const ungroupedFiles = await query(
      'SELECT * FROM files WHERE song_id = ? AND asset_type = ? AND collection_id IS NULL',
      [songId, assetType]
    );
    console.log(`[GET ASSETS] Loaded ${ungroupedFiles.length} ungrouped files`);

    return [...collections, ...ungroupedFiles];
  } catch (err) {
    console.error(`[GET ASSETS ERROR] Error loading assets for song ${songId}, type ${assetType}:`, err);
    throw err;
  }
}

// Get single song
app.get('/api/songs/:id', async (req, res) => {
  try {
    console.log(`[GET SONG] Fetching song with ID ${req.params.id}`);
    const song = await get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    if (!song) {
      console.log(`[GET SONG] Song not found with ID ${req.params.id}`);
      return res.status(404).json({ error: 'Song not found' });
    }

    console.log(`[GET SONG] Loading assets for song ${song.id}`);
    song.recordings = await getAssets(song.id, 'Recordings');
    song.sheetMusic = await getAssets(song.id, 'Sheet Music');
    song.lyrics = await getAssets(song.id, 'Lyrics');
    song.otherFiles = await getAssets(song.id, 'Other Files');

    console.log(`[GET SONG] Successfully fetched song ${song.id}: ${song.name}`);
    res.json(song);
  } catch (err) {
    console.error(`[GET SONG ERROR] Error fetching song ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to get song folder name
function getSongFolderName(songName, songId) {
  if (songName && songName.trim() !== '') {
    return preserveSpecialChars(songName);
  }
  return `song_${songId}`;
}

// Create/Update song
app.post('/api/songs', async (req, res) => {
  try {
    const { id, name, description, type, status } = req.body;
    console.log(`[SONG ${id ? 'UPDATE' : 'CREATE'}] Processing song ${id ? 'update' : 'creation'}`, 
      { id, name });
    
    if (id) {
      console.log(`[SONG UPDATE] Updating existing song ${id}`);
      const oldSong = await get('SELECT name FROM songs WHERE id = ?', [id]);
      
      await run(
        'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?',
        [name, description, type, status, id]
      );
      
      if (oldSong && oldSong.name !== name) {
        const oldFolder = getSongFolderName(oldSong.name, id);
        const newFolder = getSongFolderName(name, id);
        
        console.log(`[SONG RENAME] Renaming song from "${oldFolder}" to "${newFolder}"`);
        const oldDir = path.join(UPLOADS_DIR, oldFolder);
        const newDir = path.join(UPLOADS_DIR, newFolder);
        
        if (fs.existsSync(oldDir)) {
          console.log(`[FILESYSTEM] Renaming directory: ${oldDir} -> ${newDir}`);
          fs.renameSync(oldDir, newDir);
          
          // Update file names and paths
          const files = await query('SELECT * FROM files WHERE song_id = ?', [id]);
          console.log(`[FILE RENAME] Renaming ${files.length} files for song ${id}`);
          
          for (const file of files) {
            try {
              const oldFullPath = path.join(UPLOADS_DIR, file.file_path);
              
              // Generate new filename based on new song name
              const newFileName = generateFileName(name, file);
              const newFilePath = path.join(
                path.dirname(oldFullPath).replace(oldFolder, newFolder), 
                newFileName
              );
              
              // Rename the file
              if (fs.existsSync(oldFullPath)) {
                console.log(`[FILE RENAME] Renaming: ${oldFullPath} -> ${newFilePath}`);
                fs.renameSync(oldFullPath, newFilePath);
              }
              
              // Update database with new path
              const newRelativePath = path.relative(UPLOADS_DIR, newFilePath);
              await run('UPDATE files SET file_path = ? WHERE id = ?', [newRelativePath, file.id]);
              console.log(`[DB UPDATE] Updated file ${file.id} path to: ${newRelativePath}`);
            } catch (fileErr) {
              console.error(`[FILE RENAME ERROR] Could not rename file ${file.id}:`, fileErr);
            }
          }
        }
      }
      
      res.json({ id });
    } else {
      console.log('[SONG CREATE] Creating new song');
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
      
      // Always create song directory immediately
      const folderName = getSongFolderName(name, songId);
      const songDir = path.join(UPLOADS_DIR, folderName);
      console.log(`[FILESYSTEM] Creating song directory: ${songDir}`);
      fs.mkdirSync(songDir, { recursive: true });
      
      console.log(`[SONG CREATE] Created new song with ID: ${songId}`);
      res.json({ id: songId });
    }
  } catch (err) {
    console.error('[SONG ERROR] Error processing song:', err);
    res.status(500).json({ error: err.message });
  }
});

const preserveSpecialChars = (filename) => {
  if (!filename) return '';
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .normalize('NFC');
};

// File upload endpoint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Replace the existing app.post('/api/upload') endpoint with this:
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('[FILE UPLOAD] Starting file upload');
    
    if (!req.file) {
      console.error('[FILE UPLOAD ERROR] No file content was received by the server.');
      return res.status(400).json({ error: 'No file content received. Please select a file to upload.' });
    }

    if (!req.body.songId) {
      console.log('[FILE UPLOAD ERROR] songId is required');
      return res.status(400).json({ error: 'songId is required' });
    }
    
    const songId = parseInt(req.body.songId);
    if (isNaN(songId)) {
      console.log('[FILE UPLOAD ERROR] Invalid songId');
      return res.status(400).json({ error: 'songId must be a number' });
    }

    const { assetType, collectionName, collectionId, fileName, metadata } = req.body;
    if (!assetType) {
      console.log('[FILE UPLOAD ERROR] assetType is required');
      return res.status(400).json({ error: 'assetType is required' });
    }

    // Log received collectionId
    console.log(`[FILE UPLOAD] Received collectionId: ${collectionId}`);

    const metadataObj = JSON.parse(metadata || '{}');
    const safeName = preserveSpecialChars(fileName || (req.file ? req.file.originalname : 'unknown'));
    const fileSizeMB = req.file ? (req.file.size / 1024 / 1024).toFixed(2) : 0;

    console.log(`[FILE UPLOAD] Parameters: 
      Song ID: ${songId}
      Asset Type: ${assetType}
      Collection: ${collectionName || 'N/A'}
      Collection ID: ${collectionId || 'N/A'}
      File Name: ${safeName}
      Size: ${fileSizeMB}MB`);

    const song = await get('SELECT name, id FROM songs WHERE id = ?', [songId]);
    const songName = song?.name ? preserveSpecialChars(song.name) : `song_${songId}`;
    const folderName = getSongFolderName(songName, songId);
    
    const songDir = path.join(UPLOADS_DIR, folderName);
    if (!fs.existsSync(songDir)) {
      console.log(`[FILESYSTEM] Creating song directory: ${songDir}`);
      fs.mkdirSync(songDir, { recursive: true });
    }

    const assetDir = path.join(songDir, assetType);
    const finalDir = collectionName 
      ? path.join(assetDir, preserveSpecialChars(collectionName)) 
      : assetDir;

    console.log(`[FILESYSTEM] Ensuring directory exists: ${finalDir}`);
    fs.mkdirSync(finalDir, { recursive: true });
    
    const filePath = path.join(finalDir, safeName);
    console.log(`[FILESYSTEM] Writing file to: ${filePath}`);
    fs.writeFileSync(filePath, req.file.buffer);
    
    const relativePath = path.relative(UPLOADS_DIR, filePath);
    console.log(`[FILE UPLOAD] File saved successfully. Relative path: ${relativePath}`);

    // Prepare file data for insertion
    const fileData = {
      songId: songId,
      name: metadataObj.name || '',
      description: metadataObj.description || '',
      date: metadataObj.date || '',
      album: metadataObj.album || '',
      instrument: metadataObj.instrument || '',
      duration: metadataObj.duration || 0,
      file_path: relativePath,
      asset_type: assetType
    };

    let fileId;
    
    if (collectionId) {
      fileData.collection_id = collectionId;
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO files (
            song_id, collection_id, name, description, date, 
            album, instrument, duration, file_path, asset_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileData.songId,
            fileData.collection_id,
            fileData.name,
            fileData.description,
            fileData.date,
            fileData.album,
            fileData.instrument,
            fileData.duration,
            fileData.file_path,
            fileData.asset_type
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          }
        );
      });
      fileId = result.lastID;
    } else if (collectionName) {
      console.log(`[DB INSERT] Creating new collection: ${collectionName}`);
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
      
      fileData.collection_id = collectionRes;
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO files (
            song_id, collection_id, name, description, date, 
            album, instrument, duration, file_path, asset_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileData.songId,
            fileData.collection_id,
            fileData.name,
            fileData.description,
            fileData.date,
            fileData.album,
            fileData.instrument,
            fileData.duration,
            fileData.file_path,
            fileData.asset_type
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          }
        );
      });
      fileId = result.lastID;
      console.log(`[DB INSERT] Created collection ${collectionRes} and added file with ID: ${fileId}`);
    } else {
      console.log('[DB INSERT] Adding ungrouped file');
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO files (
            song_id, name, description, date, 
            album, instrument, duration, file_path, asset_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileData.songId,
            fileData.name,
            fileData.description,
            fileData.date,
            fileData.album,
            fileData.instrument,
            fileData.duration,
            fileData.file_path,
            fileData.asset_type
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID });
          }
        );
      });
      fileId = result.lastID;
      console.log(`[DB INSERT] Added ungrouped file with ID: ${fileId}`);
    }
    
    res.json({ success: true, filePath: relativePath, fileId });
  } catch (err) {
    console.error('[FILE UPLOAD ERROR] Upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create empty collection
app.post('/api/collections', async (req, res) => {
  try {
    const { song_id, name, asset_type, description } = req.body;
    console.log('[COLLECTION CREATE] Creating new collection', 
      { song_id, name, asset_type });
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO collections 
        (song_id, name, asset_type, description) 
        VALUES (?, ?, ?, ?)`,
        [song_id, name, asset_type, description],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`[COLLECTION CREATE] Created collection ${result}`);
    
    // CREATE COLLECTION FOLDER IMMEDIATELY
    try {
      const song = await get('SELECT name FROM songs WHERE id = ?', [song_id]);
      const songName = song?.name ? preserveSpecialChars(song.name) : `song_${song_id}`;
      const folderName = getSongFolderName(songName, song_id);
      const songDir = path.join(UPLOADS_DIR, folderName);
      const assetDir = path.join(songDir, asset_type);
      const collectionDir = path.join(assetDir, preserveSpecialChars(name));
      
      console.log(`[FILESYSTEM] Creating collection folder: ${collectionDir}`);
      fs.mkdirSync(collectionDir, { recursive: true });
    } catch (folderErr) {
      console.error('[FOLDER CREATE ERROR] Could not create collection folder:', folderErr);
    }
    
    res.json({ id: result });
  } catch (err) {
    console.error('[COLLECTION CREATE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete collection
app.delete('/api/collections/:id', async (req, res) => {
  try {
    const collectionId = req.params.id;
    console.log(`[COLLECTION DELETE] Deleting collection ${collectionId}`);
    
    // Move files to ungrouped FIRST
    await run(
      'UPDATE files SET collection_id = NULL WHERE collection_id = ?',
      [collectionId]
    );
    
    // Now delete the collection
    await run('DELETE FROM collections WHERE id = ?', [collectionId]);
    
    console.log(`[COLLECTION DELETE] Successfully deleted collection ${collectionId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[COLLECTION DELETE ERROR] Error deleting collection ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/file/:filePath(*)', (req, res) => {
  // Decode URI components to handle special characters
  const decodedPath = decodeURIComponent(req.params.filePath);
  const filePath = path.join(UPLOADS_DIR, decodedPath);
  
  console.log(`[FILE REQUEST] Attempting to serve file: ${filePath}`);
  if (fs.existsSync(filePath)) {
    console.log(`[FILE REQUEST] Serving file: ${filePath}`);
    res.sendFile(filePath);
  } else {
    console.log(`[FILE REQUEST ERROR] File not found: ${filePath}`);
    res.status(404).json({ error: 'File not found' });
  }
});

app.put('/api/songs/:id', async (req, res) => {
  try {
    const { name, description, type, status } = req.body;
    console.log(`[SONG UPDATE] Starting update for song ${req.params.id}`, 
      { name, type, status });
    
    const oldSong = await get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    if (!oldSong) {
      console.log(`[SONG UPDATE ERROR] Song not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const oldFolder = getSongFolderName(oldSong.name, req.params.id);
    const newFolder = getSongFolderName(name, req.params.id);
    const oldDir = path.join(UPLOADS_DIR, oldFolder);
    const newDir = path.join(UPLOADS_DIR, newFolder);
    
    // Create new folder structure (but don't rename yet)
    if (!fs.existsSync(newDir)) {
      console.log(`[FILESYSTEM] Creating song directory: ${newDir}`);
      fs.mkdirSync(newDir, { recursive: true });
    }
    
    if (oldSong.name !== name) {
      // First process all file renames BEFORE renaming the folder
      const files = await query('SELECT * FROM files WHERE song_id = ?', [req.params.id]);
      console.log(`[FILE RENAME] Processing ${files.length} files for song ${req.params.id}`);
      
      let renameErrors = [];
      
      for (const file of files) {
        try {
          // Get current full path (still in old location)
          const oldFullPath = path.join(UPLOADS_DIR, file.file_path);
          
          // Generate new filename based on new song name
          const newFileName = generateFileName(name, file);
          
          // Get the relative path within the song folder
          const relativePath = file.file_path.replace(`${oldFolder}/`, '');
          const fileDir = path.dirname(relativePath);
          
          // Build new path with new song folder and new filename
          const newFilePath = path.join(newFolder, fileDir, newFileName);
          const newFullPath = path.join(UPLOADS_DIR, newFilePath);
          
          // Ensure new directory exists
          const newFileDir = path.dirname(newFullPath);
          if (!fs.existsSync(newFileDir)) {
            fs.mkdirSync(newFileDir, { recursive: true });
          }
          
          // Rename the file BEFORE moving the folder
          if (fs.existsSync(oldFullPath)) {
            console.log(`[FILE RENAME] Renaming: ${oldFullPath} -> ${newFullPath}`);
            fs.renameSync(oldFullPath, newFullPath);
            
            // Update database with new path
            await run('UPDATE files SET file_path = ? WHERE id = ?', [newFilePath, file.id]);
            console.log(`[DB UPDATE] Updated file ${file.id} path to: ${newFilePath}`);
          } else {
            const errorMsg = `[FILE RENAME ERROR] Source file not found: ${oldFullPath}`;
            console.error(errorMsg);
            renameErrors.push(errorMsg);
          }
        } catch (fileErr) {
          const errorMsg = `[FILE RENAME ERROR] Could not process file ${file.id}: ${fileErr.message}`;
          console.error(errorMsg);
          renameErrors.push(errorMsg);
        }
      }
      
      // Instead of renaming the folder, remove the old folder after moving files
      if (fs.existsSync(oldDir)) {
        try {
          console.log(`[FOLDER CLEANUP] Removing old folder: ${oldDir}`);
          fs.rmSync(oldDir, { recursive: true, force: true });
        } catch (cleanupError) {
          const errorMsg = `[FOLDER CLEANUP ERROR] Could not remove old folder: ${cleanupError.message}`;
          console.error(errorMsg);
          renameErrors.push(errorMsg);
        }
      }
      
      // If there were any errors, throw them
      if (renameErrors.length > 0) {
        throw new Error(`File rename errors occurred:\n${renameErrors.join('\n')}`);
      }
    }
    
    console.log(`[DB UPDATE] Updating song ${req.params.id} in database`);
    await run(
      'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?',
      [name, description, type, status, req.params.id]
    );
    
    // Return the updated song with all assets
    const updatedSong = await get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    updatedSong.recordings = await getAssets(req.params.id, 'Recordings');
    updatedSong.sheetMusic = await getAssets(req.params.id, 'Sheet Music');
    updatedSong.lyrics = await getAssets(req.params.id, 'Lyrics');
    updatedSong.otherFiles = await getAssets(req.params.id, 'Other Files');
    
    console.log(`[SONG UPDATE] Successfully updated song ${req.params.id}`);
    res.json(updatedSong);
  } catch (err) {
    console.error(`[SONG UPDATE ERROR] Error updating song ${req.params.id}:`, err);
    res.status(500).json({ 
      error: 'Failed to update song',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Delete song endpoint
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    console.log(`[SONG DELETE] Starting deletion for song ${songId}`);
    
    const song = await get('SELECT name FROM songs WHERE id = ?', [songId]);
    const folderName = getSongFolderName(song?.name, songId);
    
    console.log(`[DB DELETE] Deleting song ${songId} from database`);
    await run('DELETE FROM songs WHERE id = ?', [songId]);
    await run('DELETE FROM files WHERE song_id = ?', [songId]);
    await run('DELETE FROM collections WHERE song_id = ?', [songId]);
    
    const songDir = path.join(UPLOADS_DIR, folderName);
    if (fs.existsSync(songDir)) {
      console.log(`[FILESYSTEM] Deleting directory: ${songDir}`);
      fs.rmSync(songDir, { recursive: true });
    }
    
    console.log(`[SONG DELETE] Successfully deleted song ${songId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[SONG DELETE ERROR] Error deleting song ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Batch delete files endpoint
app.post('/api/files/batch-delete', async (req, res) => {
  try {
    const { fileIds } = req.body;
    console.log(`[BATCH DELETE] Starting batch delete for ${fileIds.length} files`);
    
    if (!Array.isArray(fileIds)) {
      console.log('[BATCH DELETE ERROR] fileIds must be an array');
      return res.status(400).json({ error: 'fileIds must be an array' });
    }

    const placeholders = fileIds.map(() => '?').join(',');
    const files = await query(
      `SELECT file_path FROM files WHERE id IN (${placeholders})`, 
      fileIds
    );
    console.log(`[BATCH DELETE] Found ${files.length} files to delete from filesystem`);

    console.log(`[DB DELETE] Deleting ${fileIds.length} files from database`);
    await run(`DELETE FROM files WHERE id IN (${placeholders})`, fileIds);
    
    console.log('[FILESYSTEM] Starting file deletions:');
    files.forEach(file => {
      const filePath = path.join(UPLOADS_DIR, file.file_path);
      if (fs.existsSync(filePath)) {
        console.log(`[FILESYSTEM] Deleting file: ${filePath}`);
        fs.unlinkSync(filePath);
      } else {
        console.log(`[FILESYSTEM WARNING] File not found: ${filePath}`);
      }
    });
    
    console.log(`[BATCH DELETE] Successfully deleted ${files.length} files`);
    res.json({ message: 'Files deleted successfully.' });
  } catch (err) {
    console.error('[BATCH DELETE ERROR] Error during batch delete:', err);
    res.status(500).json({ error: 'Failed to delete files', details: err.message });
  }
});

function generateFileName(songName, file) {
  // Determine base name based on asset type
  let fileNameDetail = '';
  switch (file.asset_type) {
    case 'Recordings':
      fileNameDetail = file.album || file.name || 'Recording';
      break;
    case 'Sheet Music':
      fileNameDetail = file.instrument || file.name || 'Sheet';
      break;
    case 'Lyrics':
      fileNameDetail = file.name || 'Lyrics';
      break;
    case 'Other Files':
      fileNameDetail = file.name || 'File';
      break;
    default:
      fileNameDetail = file.name || 'File';
  }
  
  // Extract year from date if available
  let year = '';
  if (file.date) {
    const yearMatch = file.date.match(/\b\d{4}\b/);
    if (yearMatch) year = ` -- ${yearMatch[0]}`;
  }
  
  // Get file extension from current path
  const ext = file.file_path ? 
    path.extname(file.file_path) : 
    '';
  
  // Construct safe filename with preserved special characters
  return `${preserveSpecialChars(songName)} - ${preserveSpecialChars(fileNameDetail)}${year}${ext}`;
}

// Update file metadata endpoint (FIXED to handle collection_id)
app.put('/api/files/:id', async (req, res) => {
  let oldFullPath, newPath;
  try {
    const { name, description, date, album, instrument, duration, collection_id } = req.body;
    const fileId = req.params.id;
    
    console.log(`[FILE UPDATE] Starting update for file ${fileId}`, 
      { name, description, date, album, instrument, duration, collection_id });

    // Get original file
    const file = await get('SELECT * FROM files WHERE id = ?', [fileId]);
    if (!file) {
      console.log(`[FILE UPDATE ERROR] File not found: ${fileId}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get song name
    const song = await get('SELECT name FROM songs WHERE id = ?', [file.song_id]);
    const songName = song?.name || 'Untitled Song';
    
    // Create updated file object with new values
    const updatedFile = {
      ...file,
      name: name || file.name,
      description: description || file.description,
      date: date || file.date,
      album: album || file.album,
      instrument: instrument || file.instrument,
      duration: duration || file.duration,
      collection_id: collection_id !== undefined ? collection_id : file.collection_id,
      asset_type: file.asset_type
    };
    
    // Generate new filename using consistent pattern
    const newFileName = generateFileName(songName, updatedFile);
    
    // Build NEW path based on collection (if any)
    const songFolder = getSongFolderName(songName, file.song_id);
    const baseDir = path.join(UPLOADS_DIR, songFolder, updatedFile.asset_type);
    
    let collectionName = null;
    if (updatedFile.collection_id) {
      const collection = await get('SELECT name FROM collections WHERE id = ?', [updatedFile.collection_id]);
      collectionName = collection?.name || null;
    }
    
    const newDir = collectionName 
      ? path.join(baseDir, preserveSpecialChars(collectionName))
      : baseDir;
    
    // Ensure new directory exists
    fs.mkdirSync(newDir, { recursive: true });
    
    // Build full new path
    newPath = path.join(newDir, newFileName);
    
    // Get current full path
    oldFullPath = path.join(UPLOADS_DIR, file.file_path);
    
    // Only move/rename if path changed
    if (oldFullPath !== newPath) {
      console.log(`[FILE MOVE] Moving file: ${oldFullPath} -> ${newPath}`);
      
      // Move the file
      if (fs.existsSync(oldFullPath)) {
        fs.renameSync(oldFullPath, newPath);
      } else {
        console.warn(`[FILE MOVE WARNING] Original file not found: ${oldFullPath}`);
        return res.status(404).json({ error: 'Original file not found' });
      }
    }

    const relativePath = path.relative(UPLOADS_DIR, newPath);
    console.log(`[DB UPDATE] Updating file ${fileId} with new path: ${relativePath}`);
    
    await run(
      `UPDATE files SET 
        name = ?,
        description = ?,
        date = ?,
        album = ?,
        instrument = ?,
        duration = ?,
        file_path = ?,
        collection_id = ?
      WHERE id = ?`,
      [
        updatedFile.name,
        updatedFile.description,
        updatedFile.date,
        updatedFile.album,
        updatedFile.instrument,
        updatedFile.duration,
        relativePath,
        updatedFile.collection_id,
        fileId
      ]
    );

    const resultFile = await get('SELECT * FROM files WHERE id = ?', [fileId]);
    console.log(`[FILE UPDATE] Successfully updated file ${fileId}`);
    res.json(resultFile);
  } catch (err) {
    console.error(`[FILE UPDATE ERROR] Error updating file ${fileId}:`, err);
    
    // Attempt to revert file move if error occurred
    if (oldFullPath && newPath && fs.existsSync(newPath)) {
      try {
        console.log(`[FILE ROLLBACK] Attempting to revert move: ${newPath} -> ${oldFullPath}`);
        fs.renameSync(newPath, oldFullPath);
      } catch (revertErr) {
        console.error('[FILE ROLLBACK ERROR] Error reverting file move:', revertErr);
      }
    }
    
    res.status(500).json({ error: err.message });
  }
});

// Update collection endpoint
app.put('/api/collections/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    console.log(`[COLLECTION UPDATE] Starting update for collection ${req.params.id}`, 
      { name, description });
    
    const oldCollection = await get(
      'SELECT * FROM collections WHERE id = ?', 
      [req.params.id]
    );
    
    if (!oldCollection) {
      console.log(`[COLLECTION UPDATE ERROR] Collection not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    console.log(`[DB UPDATE] Updating collection ${req.params.id}`);
    await run(
      'UPDATE collections SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );
    
    if (oldCollection.name !== name) {
      console.log(`[COLLECTION RENAME] Renaming from "${oldCollection.name}" to "${name}"`);
      const song = await get('SELECT name FROM songs WHERE id = ?', [oldCollection.song_id]);
      if (song) {
        const oldPath = path.join(
          UPLOADS_DIR,
          preserveSpecialChars(song.name),
          preserveSpecialChars(oldCollection.asset_type),
          preserveSpecialChars(oldCollection.name)
        );
        
        const newPath = path.join(
          UPLOADS_DIR,
          preserveSpecialChars(song.name),
          preserveSpecialChars(oldCollection.asset_type),
          preserveSpecialChars(name)
        );
        
        if (fs.existsSync(oldPath)) {
          console.log(`[FILESYSTEM] Renaming collection directory: ${oldPath} -> ${newPath}`);
          fs.renameSync(oldPath, newPath);
          
          // Update file paths for ALL files in the collection
          const files = await query(
            'SELECT id, file_path FROM files WHERE collection_id = ?',
            [req.params.id]
          );
          console.log(`[DB UPDATE] Updating ${files.length} file paths`);
          
          for (const file of files) {
            // Calculate new path by replacing old collection name
            const newFilePath = file.file_path.replace(
              new RegExp(`${preserveSpecialChars(oldCollection.name)}\\/`, 'g'),
              `${preserveSpecialChars(name)}/`
            );
            
            // Move the physical file
            const oldFullPath = path.join(UPLOADS_DIR, file.file_path);
            const newFullPath = path.join(UPLOADS_DIR, newFilePath);
            
            if (fs.existsSync(oldFullPath)) {
              fs.renameSync(oldFullPath, newFullPath);
            }
            
            await run('UPDATE files SET file_path = ? WHERE id = ?', [newFilePath, file.id]);
          }
        }
      }
    }
    
    console.log(`[COLLECTION UPDATE] Successfully updated collection ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[COLLECTION UPDATE ERROR] Error updating collection ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Initialize and start server
initDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Server running on port ${PORT}`);
    console.log(`[SERVER] Database location: ${DB_PATH}`);
    console.log(`[SERVER] Uploads directory: ${UPLOADS_DIR}`);
  });
}).catch(err => {
  console.error('[SERVER ERROR] Database initialization failed:', err);
  process.exit(1);
});