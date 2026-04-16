const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const os = require('os');
const { getUploadsBase } = require('../fileUtils');
const db = require('../database');

const pipelineAsync = promisify(pipeline);

const getRestoreDir = () => process.env.RESTORE_DIR || path.join(__dirname, '..', 'restore');

// Find the most recently modified .zip in the restore directory, or null if none.
const findRestoreZip = () => {
  const dir = getRestoreDir();
  if (!fs.existsSync(dir)) return null;
  const zips = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.zip'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips.length ? path.join(dir, zips[0].name) : null;
};

// GET /api/backup
// Streams a zip containing the uploads directory and the SQLite database.
router.get('/', (_req, res) => {
  const uploadsDir = getUploadsBase();
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'music.db');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('error', (err) => {
    console.error('Backup archive error:', err);
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

// GET /api/backup/restore-status
// Returns whether any .zip is present in the restore directory.
router.get('/restore-status', (_req, res) => {
  const zipPath = findRestoreZip();
  res.json({ ready: !!zipPath, filename: zipPath ? path.basename(zipPath) : null });
});

// GET /api/backup/restore-stream
// SSE endpoint: reads the ZIP central directory, then extracts files one by one
// sending progress events, then replaces the database and uploads directory.
router.get('/restore-stream', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Keep the SSE connection alive during long sync/async operations so Nginx
  // proxy_read_timeout never fires. SSE comment lines are ignored by clients.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  const extractDir = path.join(os.tmpdir(), `restore_extract_${Date.now()}`);

  try {
    const zipPath = findRestoreZip();
    if (!zipPath) {
      clearInterval(heartbeat);
      send({ type: 'error', message: 'Ingen ZIP-fil hittades i restore-mappen.' });
      res.end();
      return;
    }

    send({ type: 'status', message: `Läser ${path.basename(zipPath)}...` });

    // Read the central directory (fast — seeks to end of file only)
    const directory = await unzipper.Open.file(zipPath);
    const fileEntries = directory.files.filter(f => f.type === 'File');
    const total = fileEntries.length;

    send({ type: 'total', count: total });
    fs.mkdirSync(extractDir, { recursive: true });

    let fileCount = 0;
    for (const entry of fileEntries) {
      const targetPath = path.join(extractDir, entry.path);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      await pipelineAsync(entry.stream(), fs.createWriteStream(targetPath));

      fileCount++;
      send({ type: 'file', name: entry.path, count: fileCount, total });
    }

    const extractedDb = path.join(extractDir, 'music.db');
    if (!fs.existsSync(extractedDb)) {
      clearInterval(heartbeat);
      fs.rmSync(extractDir, { recursive: true, force: true });
      send({ type: 'error', message: 'Ogiltig backup: music.db saknas i ZIP-filen.' });
      res.end();
      return;
    }

    send({ type: 'status', message: 'Återställer databas...' });
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'music.db');
    db.close();
    fs.copyFileSync(extractedDb, dbPath);

    const uploadsDir = getUploadsBase();
    const extractedUploads = path.join(extractDir, 'uploads');
    if (fs.existsSync(extractedUploads)) {
      send({ type: 'status', message: 'Kopierar uppladdade filer...' });
      // Can't rmdir the mount point itself — clear its contents instead.
      // Use async fs.promises so the event loop stays free for SSE heartbeats.
      for (const entry of await fs.promises.readdir(uploadsDir)) {
        await fs.promises.rm(path.join(uploadsDir, entry), { recursive: true, force: true });
      }
      await fs.promises.cp(extractedUploads, uploadsDir, { recursive: true });
    }

    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (err) { console.warn('Could not clean up extract dir:', extractDir, err.message); }

    clearInterval(heartbeat);
    send({ type: 'done' });
    res.end();

    // Exit immediately so Docker restarts the container with the new DB.
    // No delay — any gap here causes "database connection is not open" errors.
    setImmediate(() => process.exit(0));

  } catch (err) {
    clearInterval(heartbeat);
    console.error('Restore error:', err);
    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (cleanupErr) { console.warn('Could not clean up extract dir:', extractDir, cleanupErr.message); }
    send({ type: 'error', message: err.message });
    res.end();
  }
});

module.exports = router;
