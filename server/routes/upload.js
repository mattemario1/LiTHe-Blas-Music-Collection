const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const { constructFileName, getSongAssetDir, toRelativePath, resolveUniqueFilePath } = require('../fileUtils');

// Formats that need transcoding to MP4 before storing
const TRANSCODE_EXTS = new Set(['.wmv', '.avi', '.mkv', '.mov', '.flv', '.m4v']);

// Write uploaded files to a temp dir on disk to avoid loading large videos into memory
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `upload_${Date.now()}_${path.basename(file.originalname)}`),
  }),
});

function transcodeToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// POST /api/upload
// Expects multipart/form-data with:
//   - file: the actual file
//   - songId: the song this file belongs to
//   - songName: used for filename construction
//   - assetType: 'recordings' | 'sheetMusic' | 'lyrics' | 'otherFiles'
//   - metadata: JSON string with name, album, instrument, date etc
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { songId, songName, assetType } = req.body;
    const metadata = JSON.parse(req.body.metadata || '{}');

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!songId || !assetType) {
      return res.status(400).json({ error: 'songId and assetType are required' });
    }

    const dir = getSongAssetDir(songName || 'Song', assetType);
    const ext = path.extname(req.file.originalname).toLowerCase();

    const tempUploadPath = req.file.path;

    try {
      if (TRANSCODE_EXTS.has(ext)) {
        const mp4FileName = constructFileName(songName || 'Song', metadata, assetType, '.mp4', metadata.collectionName);
        const mp4TargetPath = resolveUniqueFilePath(path.join(dir, mp4FileName));
        await transcodeToMp4(tempUploadPath, mp4TargetPath);
        return res.json({ filePath: toRelativePath(mp4TargetPath) });
      }

      // Non-video or already-compatible format: move to final location
      const fileName = constructFileName(songName || 'Song', metadata, assetType, ext, metadata.collectionName);
      const targetPath = resolveUniqueFilePath(path.join(dir, fileName));
      fs.copyFileSync(tempUploadPath, targetPath);
      res.json({ filePath: toRelativePath(targetPath) });
    } finally {
      fs.unlink(tempUploadPath, () => {});
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
