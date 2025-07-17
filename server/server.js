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

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('[FILE UPLOAD] Starting file upload');
    
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

    const metadataObj = JSON.parse(metadata || '{}');
    const safeName = preserveSpecialChars(fileName || req.file.originalname);
    
    console.log(`[FILE UPLOAD] Parameters: 
      Song ID: ${songId}
      Asset Type: ${assetType}
      Collection: ${collectionName || 'N/A'}
      File Name: ${safeName}
      Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);

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

    if (collectionId) {
      console.log(`[DB INSERT] Adding file to existing collection ${collectionId}`);
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
      console.log(`[DB INSERT] Added file with ID: ${this.lastID}`);
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
      console.log(`[DB INSERT] Created collection ${collectionRes} and added file with ID: ${this.lastID}`);
    } else {
      console.log('[DB INSERT] Adding ungrouped file');
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
      console.log(`[DB INSERT] Added ungrouped file with ID: ${this.lastID}`);
    }
    
    res.json({ success: true, filePath: relativePath });
  } catch (err) {
    console.error('[FILE UPLOAD ERROR] Upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/file/:filePath(*)', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filePath);
  console.log(`[FILE REQUEST] Attempting to serve file: ${filePath}`);
  if (fs.existsSync(filePath)) {
    console.log(`[FILE REQUEST] Serving file: ${filePath}`);
    res.sendFile(filePath);
  } else {
    console.log(`[FILE REQUEST ERROR] File not found: ${filePath}`);
    res.status(404).json({ error: 'File not found' });
  }
});

// Update song endpoint - FIXED FILE RENAMING AFTER FOLDER RENAME
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
    
    // Always create folder if it doesn't exist
    const newDir = path.join(UPLOADS_DIR, newFolder);
    if (!fs.existsSync(newDir)) {
      console.log(`[FILESYSTEM] Creating song directory: ${newDir}`);
      fs.mkdirSync(newDir, { recursive: true });
    }
    
    if (oldSong.name !== name) {
      const oldDir = path.join(UPLOADS_DIR, oldFolder);
      
      console.log(`[SONG RENAME] Checking directory rename: ${oldDir} -> ${newDir}`);
      
      if (fs.existsSync(oldDir) && oldDir !== UPLOADS_DIR) {
        try {
          console.log(`[FILESYSTEM] Renaming directory: ${oldDir} -> ${newDir}`);
          fs.renameSync(oldDir, newDir);
        } catch (renameError) {
          console.error('[SONG RENAME ERROR] Folder rename failed:', renameError);
          return res.status(500).json({ error: 'Failed to rename song folder' });
        }

        // Get files BEFORE renaming so we have the original paths
        const files = await query('SELECT * FROM files WHERE song_id = ?', [req.params.id]);
        console.log(`[FILE RENAME] Renaming ${files.length} files for song ${req.params.id}`);
        
        for (const file of files) {
          try {
            // Calculate current path based on new folder location
            const currentPath = file.file_path.replace(oldFolder, newFolder);
            const currentFullPath = path.join(UPLOADS_DIR, currentPath);
            
            // Generate new filename with new song name
            const newFileName = generateFileName(name, file);
            
            // Build new path by replacing the filename
            const newFilePath = path.join(
              path.dirname(currentFullPath),
              newFileName
            );
            
            // Rename the file
            if (fs.existsSync(currentFullPath)) {
              console.log(`[FILE RENAME] Renaming: ${currentFullPath} -> ${newFilePath}`);
              fs.renameSync(currentFullPath, newFilePath);
            } else {
              console.warn(`[FILE RENAME WARNING] File not found: ${currentFullPath}`);
            }
            
            // Update database with new path
            const relativePath = path.relative(UPLOADS_DIR, newFilePath);
            await run('UPDATE files SET file_path = ? WHERE id = ?', [relativePath, file.id]);
            console.log(`[DB UPDATE] Updated file ${file.id} path to: ${relativePath}`);
          } catch (fileErr) {
            console.error(`[FILE RENAME ERROR] Could not rename file ${file.id}:`, fileErr);
          }
        }
      }
    }
    
    console.log(`[DB UPDATE] Updating song ${req.params.id} in database`);
    await run(
      'UPDATE songs SET name = ?, description = ?, type = ?, status = ? WHERE id = ?',
      [name, description, type, status, req.params.id]
    );
    
    console.log(`[SONG UPDATE] Successfully updated song ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[SONG UPDATE ERROR] Error updating song ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
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

// Generate filename with consistent structure
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
  
  // Extract year from date
  let year = '';
  if (file.date) {
    const yearMatch = file.date.match(/\b\d{4}\b/);
    if (yearMatch) {
      year = ` -- ${yearMatch[0]}`;
    }
  }
  
  // Get file extension from original path
  const ext = file.file_path ? path.extname(file.file_path) : '';
  
  return `${preserveSpecialChars(songName)} - ${preserveSpecialChars(fileNameDetail)}${year}${ext}`;
}

// Update file metadata endpoint (FIXED RENAMING LOGIC)
app.put('/api/files/:id', async (req, res) => {
  let oldFullPath, newPath;
  try {
    const { name, description, date, album, instrument, duration } = req.body;
    const fileId = req.params.id;
    
    console.log(`[FILE UPDATE] Starting update for file ${fileId}`, 
      { name, description, date, album, instrument, duration });

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
      asset_type: file.asset_type
    };
    
    // Generate new filename using consistent pattern
    const newFileName = generateFileName(songName, updatedFile);
    
    // Build paths
    oldFullPath = path.join(UPLOADS_DIR, file.file_path);
    const newDirPath = path.dirname(oldFullPath);
    newPath = path.join(newDirPath, newFileName);

    // Rename file if path changed
    if (oldFullPath !== newPath) {
      console.log(`[FILE RENAME] Renaming file: ${oldFullPath} -> ${newPath}`);
      if (fs.existsSync(oldFullPath)) {
        fs.renameSync(oldFullPath, newPath);
      } else {
        console.warn(`[FILE RENAME WARNING] Original file not found: ${oldFullPath}`);
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
        file_path = ?
      WHERE id = ?`,
      [
        updatedFile.name,
        updatedFile.description,
        updatedFile.date,
        updatedFile.album,
        updatedFile.instrument,
        updatedFile.duration,
        relativePath,
        fileId
      ]
    );

    const resultFile = await get('SELECT * FROM files WHERE id = ?', [fileId]);
    console.log(`[FILE UPDATE] Successfully updated file ${fileId}`);
    res.json(resultFile);
  } catch (err) {
    console.error(`[FILE UPDATE ERROR] Error updating file ${req.params.id}:`, err);
    
    // Revert file rename if error occurred
    if (oldFullPath && newPath && fs.existsSync(newPath)) {
      try {
        console.log(`[FILE ROLLBACK] Attempting to revert rename: ${newPath} -> ${oldFullPath}`);
        fs.renameSync(newPath, oldFullPath);
      } catch (revertErr) {
        console.error('[FILE ROLLBACK ERROR] Error reverting file rename:', revertErr);
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
          
          const files = await query(
            'SELECT id, file_path FROM files WHERE collection_id = ?',
            [req.params.id]
          );
          console.log(`[DB UPDATE] Updating ${files.length} file paths`);
          
          for (const file of files) {
            const newFilePath = file.file_path.replace(
              preserveSpecialChars(oldCollection.name),
              preserveSpecialChars(name)
            );
            await run('UPDATE files SET file_path = ? WHERE id = ?', [newFilePath, file.id]);
            console.log(`[DB UPDATE] Updated file ${file.id} path: ${newFilePath}`);
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