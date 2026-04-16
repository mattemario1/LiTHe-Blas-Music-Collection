const express = require('express');
const path = require('path');
const fs = require('fs');

const songsRouter = require('./routes/songs');
const uploadRouter = require('./routes/upload');
const albumsRouter = require('./routes/albums');
const backupRouter = require('./routes/backup');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const BIND_ADDRESS = process.env.BIND_ADDRESS || 'localhost';

// Parse JSON request bodies
app.use(express.json());

// API routes
app.use('/api/songs', songsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/auth', authRouter);

// Serve uploaded files
// e.g. GET /file/songs/42/recordings/foo.mp3
app.get('/file/*', (req, res) => {
  const relativePath = req.params[0];
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
  const absolutePath = path.join(uploadsDir, relativePath);

  // Guard against path traversal (e.g. /file/../../../etc/passwd)
  const resolvedUploads = path.resolve(uploadsDir) + path.sep;
  if (!path.resolve(absolutePath).startsWith(resolvedUploads)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(absolutePath);
});

// In production, serve the React frontend
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // For any non-API route, send the React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, BIND_ADDRESS, () => {
  console.log(`Server running on ${BIND_ADDRESS}:${PORT}`);
});

module.exports = app;
