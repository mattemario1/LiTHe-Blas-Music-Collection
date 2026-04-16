# LiTHe Blas Music Collection

A web app for managing the LiTHe Blas orchestra's music library. Lets you browse, upload, and organize recordings, sheet music, lyrics, dance files, and other assets per song, as well as browse recordings grouped by album.

## What's in the repo

In production the app runs as two Docker containers:
- **frontend** — Nginx serving the built React app on port 8080, proxying `/api` and `/file` to the backend
- **backend** — Express on port 5000, serving the API and uploaded files

### File structure

```
.
├── docker-compose.yml          # Defines the two containers (frontend + backend)
├── .env.example                # Template for local config — copy to .env and fill in
│
├── client/                     # React + Vite frontend
│   ├── Dockerfile              # Builds the React app and serves it via Nginx
│   ├── nginx.conf              # Nginx config: proxies /api and /file to the backend
│   ├── vite.config.js          # Vite config: dev-mode proxy to backend
│   ├── index.html              # HTML entry point
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Root component: holds global state (songs, selected song, audio)
│       ├── App.css             # Global styles
│       ├── context/
│       │   └── AuthContext.jsx # Auth state (password-protected write operations)
│       └── components/
│           ├── SearchAndFilter.jsx   # Search bar and type/status filter checkboxes
│           ├── SongList.jsx          # Left panel: filtered list of songs
│           ├── SongDetails.jsx       # Right panel: displays a song's files and metadata
│           ├── SongEditor.jsx        # Edit mode wrapper for a song
│           ├── SongFieldsEditor.jsx  # Text fields (name, description, type, status)
│           ├── SongAssetEditor.jsx   # File upload and management per asset type
│           ├── AlbumView.jsx         # Alternate view: browse recordings grouped by album
│           ├── AudioPlayer.jsx       # Persistent audio player bar at the bottom
│           ├── VideoModal.jsx        # Modal for playing video files
│           ├── PdfModal.jsx          # Modal for viewing PDFs
│           ├── LyricsModal.jsx       # Modal for viewing plain-text lyrics
│           ├── ImageModal.jsx        # Modal for viewing images
│           └── uploadUtils.js        # Shared upload helpers (file sending, duration probing)
│
└── server/                     # Express + SQLite backend
    ├── Dockerfile              # Node 18 image with ffmpeg installed
    ├── index.js                # Server entry point: mounts routes, serves uploaded files
    ├── database.js             # Opens the SQLite DB and creates tables on first run
    ├── fileUtils.js            # Helpers for renaming/moving files on disk
    ├── routes/
    │   ├── songs.js            # CRUD for songs (GET/POST/PUT/DELETE /api/songs)
    │   ├── albums.js           # Album metadata and cover image (GET/PUT /api/albums)
    │   ├── upload.js           # File upload handler: saves to disk, transcodes video, probes duration
    │   ├── auth.js             # Password check endpoint for write operations
    │   └── backup.js           # Backup download and SSE-streamed restore endpoint
    └── scripts/                # One-off admin scripts (run inside the Docker container)
        ├── import.js                    # Bulk-import an existing folder of assets
        ├── transcode-existing-videos.js # Convert old videos to H.264 MP4
        └── backfill-durations.js        # Fill in missing duration values via ffprobe
```

---

## Running with Docker (production)

### Prerequisites

- Docker and Docker Compose installed

### First-time setup

The backend stores uploaded files and the SQLite database in directories on the host, outside the repo. You configure where by creating a `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and set `UPLOADS_DIR` and `DB_DIR` to wherever you want the data to live, then create those directories:

```bash
mkdir -p /your/chosen/uploads /your/chosen/data
```

### Build and start

```bash
docker-compose up -d --build
```

The app is then available at [http://localhost:8080](http://localhost:8080).

### Other commands

```bash
docker-compose down          # stop containers
docker-compose logs -f       # tail logs from both containers
```

---

## Local development

Run the backend and frontend as separate processes.

### Backend (port 5000)

```bash
cd server
npm install
npm run dev   # auto-reloads with nodemon
```

### Frontend (Vite dev server)

```bash
cd client
npm install
npm run dev   # proxies /api and /file to localhost:5000
```

---

## Backup and restore

### Downloading a backup

In the app, log in as admin and click **💾 Download Backup** at the bottom of the page. This downloads a ZIP file (named `backup-<timestamp>.zip`) containing:

- `music.db` — the full SQLite database
- `uploads/` — all uploaded files (recordings, sheet music, etc.)

Store this file somewhere safe.

### Restoring a backup

Because backup files can be several gigabytes, restoring is done by copying the file directly to the server rather than uploading it through the browser.

**1. Add `RESTORE_DIR` to your `.env`** (if not already set):

```
RESTORE_DIR=/your/chosen/restore-dir
```

Create that directory on the host and rebuild if this is the first time:

```bash
mkdir -p /your/chosen/restore-dir
docker-compose up -d --build
```

**2. Copy the backup ZIP to the restore directory:**

```bash
scp backup-2025-04-16T12-30-00.zip user@yourserver:/your/chosen/restore-dir/
```

The file can have any name — the server picks the most recently modified `.zip` in that folder.

**3. Click ⬆️ Restore Backup** in the admin UI.

A fullscreen overlay appears showing each file being extracted. When it finishes, the server restarts automatically (Docker's `restart: unless-stopped` policy brings it back up). Click **Ladda om sidan** once the overlay shows "Klar!" to reload the app.

> **Note:** Restore replaces all data — the database and all uploaded files. Make sure you have a current backup before restoring an older one.

---

## One-time migration scripts

These are only needed when migrating existing data, not for normal operation.

| Script | What it does |
|--------|--------------|
| `scripts/import.js <source_dir>` | Bulk-imports an existing folder of assets into the library |
| `scripts/transcode-existing-videos.js` | Converts pre-existing videos in unsupported formats (wmv, avi, mkv, mov, flv, m4v) to H.264 MP4 and updates the DB paths |
| `scripts/backfill-durations.js` | Probes audio/video duration via ffprobe for all DB files that have `duration = 0` |

Run them inside the backend container:

```bash
docker exec -it lithe-blas-music-collection-backend-1 node scripts/<script-name>.js [--dry-run]
```

### Importing an existing music library

The import script expects one subfolder per song, each containing:

```
SongName/
  Inspelningar/   → recordings
  Noter/          → sheet music
  Dans/           → dance files
  *.txt / *.pdf   → lyrics (root-level files)
```

Copy the folder into the running backend container and run the script:

```bash
docker cp /path/to/assets lithe-blas-music-collection-backend-1:/tmp/inspelningar

# Preview what will be imported without making changes:
docker exec lithe-blas-music-collection-backend-1 node scripts/import.js /tmp/inspelningar --dry-run

# Run the actual import:
docker exec lithe-blas-music-collection-backend-1 node scripts/import.js /tmp/inspelningar
```

---

## Configuration

In production, `docker-compose.yml` reads from `.env` (copy from `.env.example` and fill in your paths). The backend also accepts these environment variables directly:

| Variable | Default (local dev) | Description |
|----------|---------------------|-------------|
| `UPLOADS_DIR` | `server/uploads/` | Where uploaded files are stored on disk |
| `DB_PATH` | `server/data/songs.db` | Path to the SQLite database file |
| `RESTORE_DIR` | `server/restore/` | Directory where a backup `.zip` is placed for server-side restore |
| `BIND_ADDRESS` | `127.0.0.1` | Address the Express server binds to (`0.0.0.0` in Docker) |
| `NODE_ENV` | — | Set to `production` in Docker |
