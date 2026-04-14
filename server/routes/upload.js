const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { constructFileName, getSongAssetDir, toRelativePath, resolveUniqueFilePath } = require('../fileUtils');

// Use memory storage so we can inspect the file before saving it
// (we need the song name and metadata to construct the filename)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload
// Expects multipart/form-data with:
//   - file: the actual file
//   - songId: the song this file belongs to
//   - songName: used for filename construction
//   - assetType: 'recordings' | 'sheetMusic' | 'lyrics' | 'otherFiles'
//   - metadata: JSON string with name, album, instrument, date etc
router.post('/', upload.single('file'), (req, res) => {
  try {
    const { songId, songName, assetType } = req.body;
    const metadata = JSON.parse(req.body.metadata || '{}');

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!songId || !assetType) {
      return res.status(400).json({ error: 'songId and assetType are required' });
    }

    // Get the directory to save this file in (creates it if needed)
    const dir = getSongAssetDir(songName || 'Song', assetType);

    // Construct a meaningful filename from the metadata
    const ext = path.extname(req.file.originalname);
    const fileName = constructFileName(songName || 'Song', metadata, assetType, ext, metadata.collectionName);

    // Make sure we don't overwrite an existing file
    const targetPath = resolveUniqueFilePath(path.join(dir, fileName));

    // Write the file to disk
    require('fs').writeFileSync(targetPath, req.file.buffer);

    // Return the relative path (this is what gets stored in the DB later)
    const relativePath = toRelativePath(targetPath);

    res.json({ filePath: relativePath });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
