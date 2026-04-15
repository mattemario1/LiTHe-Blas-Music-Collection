const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { getUploadsBase } = require('../fileUtils');

// GET /api/backup
// Streams a zip containing the uploads directory and the SQLite database.
router.get('/', (req, res) => {
  const uploadsDir = getUploadsBase();
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'music.db');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('Backup archive error:', err);
    // If headers not yet sent this would set status, but at this point we're streaming
    res.end();
  });

  archive.pipe(res);

  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, 'uploads');
  }

  if (fs.existsSync(dbPath)) {
    archive.file(dbPath, { name: 'music.db' });
  }

  archive.finalize();
});

module.exports = router;
