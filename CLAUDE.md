# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Production (Docker)
```bash
docker-compose up -d --build   # build and start
docker-compose down            # stop
docker-compose logs -f         # tail logs
```

### Local Development

**Backend** (runs on port 5000):
```bash
cd server && npm install
npm run dev       # nodemon auto-reload
npm start         # plain node
```

**Frontend** (runs on Vite dev server, proxies `/api` and `/file` to backend):
```bash
cd client && npm install
npm run dev       # vite dev server
npm run build     # production build -> ../dist
```

No test suite exists in this project.

## Architecture

This is a music library app for the LiTHe Blas orchestra. It has two services:

- **`server/`** — Express + better-sqlite3 backend (CommonJS, Node)
- **`client/`** — React + Vite frontend (ES modules)

In production (Docker), there are two containers: the backend (Express on port 5000) and a separate Nginx frontend container (port 8080) that proxies `/api` and `/file` requests to the backend. In development, run both services separately.

### Data Model

The SQLite database has four tables:

- **`songs`** — core song metadata: `name`, `description`, `type`, `status`
- **`collections`** — named groupings of files within a song (e.g. "Trumpet section"), linked to a `song_id` and `asset_type`
- **`files`** — individual files, always linked to a `song_id`, optionally to a `collection_id`; fields include `asset_type`, `file_path`, `name`, `description`, `date`, `album`, `instrument`, `duration`
- **`albums`** — metadata (cover, description, year) keyed by album name; albums themselves are derived by querying distinct `album` values from `files`, not stored as a primary entity

The five asset types are: `recordings`, `sheetMusic`, `lyrics`, `otherFiles`, `danceFiles`.

Video files are an asset type that can appear in any category (commonly `danceFiles`). Uploaded videos in formats requiring transcoding (`.wmv`, `.avi`, `.mkv`, `.mov`, `.flv`, `.m4v`) are automatically converted to H.264 MP4 by the upload route at write time — the stored file and DB path will always have a `.mp4` extension. Natively browser-compatible formats (`.mp4`, `.webm`) are stored as-is.

### Infrastructure Notes

- **Nginx body size limit** for `/api` is set to `4096M` in `client/nginx.conf` to allow large video uploads.
- **multer** uses disk storage (temp dir via `os.tmpdir()`) in `server/routes/upload.js`, not memory storage, so large files are not buffered in RAM.
- **ffmpeg** is installed in the backend Docker image (`server/Dockerfile`) and used via `fluent-ffmpeg` for server-side video transcoding.
- The **Content Security Policy** in `client/nginx.conf` covers `default-src 'self'` for the frontend. Do not add `'unsafe-eval'` or `'wasm-unsafe-eval'` — no client-side WebAssembly is used.

### File Storage

Uploaded files live outside the repo in a directory set by `UPLOADS_DIR` (Docker) or `server/uploads/` (local). Paths stored in the DB are **relative** to that uploads root.

Directory layout on disk:
```
uploads/
  songs/{sanitized-song-name}/recordings/
  songs/{sanitized-song-name}/sheet_music/
  songs/{sanitized-song-name}/lyrics/
  songs/{sanitized-song-name}/other/
  songs/{sanitized-song-name}/dance/
  albums/{sanitized-album-name}/cover.{ext}
```

**Important:** when a song is renamed via `PUT /api/songs/:id`, the server automatically renames the song's directory on disk and updates all `file_path` values in the DB within a single transaction ([server/routes/songs.js](server/routes/songs.js)). Individual files are also renamed to match updated metadata via `renameFileIfNeeded` in [server/fileUtils.js](server/fileUtils.js). Filenames follow the pattern `{song_name}-{collection_name}-{key_metadata}--{date}.{ext}`.

Files are served directly via `GET /file/*` which resolves relative paths against `UPLOADS_DIR`.

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/songs` | All songs with full nested assets |
| GET | `/api/songs/:id` | Single song with full nested assets |
| POST | `/api/songs` | Create empty song |
| PUT | `/api/songs/:id` | Save full song (handles renames, deletions, re-inserts) |
| DELETE | `/api/songs/:id` | Delete song and its physical files |
| POST | `/api/upload` | Upload a file; returns `{ filePath, duration }` (duration in seconds, 0 for non-media) |
| GET | `/api/albums` | Albums derived from recording metadata, with songs grouped |
| PUT | `/api/albums/:name` | Upsert album description/year |
| POST | `/api/albums/:name/cover` | Upload cover image |

### Frontend File Viewers

`SongDetails.jsx` renders action buttons per file based on extension sets:
- `AUDIO_EXTS` — `mp3 wav ogg flac aac m4a opus` → "Spela Musik" button → `AudioPlayer`
- `VIDEO_EXTS` — `mp4 webm ogv mov mkv avi wmv flv m4v` → "Visa Video" button → `VideoModal`
- `PDF_EXTS` — `pdf` → "Visa PDF" → `PdfModal`
- `TEXT_EXTS` — `txt md` → "Visa Text" → `LyricsModal`
- `IMAGE_EXTS` — `jpg jpeg png gif webp svg bmp` → "Visa Bild" → `ImageModal`

`VideoModal` is a plain `<video src=...>` player with a download fallback if playback fails. All transcoding happens server-side at upload time, not in the browser.

### Frontend Structure

The React app is a single-page layout with no client-side routing. State lives in [client/src/App.jsx](client/src/App.jsx):
- `songs` — full song list loaded once on mount
- `selectedSong` — currently viewed song
- `audioInfo` — track currently loaded in the audio player

`SearchAndFilter.jsx` handles the search bar and type/status checkboxes at the top. `SongList.jsx` renders the filtered list on the left; clicking a song loads `SongDetails.jsx` on the right. When the user clicks Edit, it swaps to `SongEditor.jsx` which contains `SongFieldsEditor.jsx` (text fields) and `SongAssetEditor.jsx` (file upload/management). `AlbumView.jsx` is an alternate top-level view for browsing recordings by album (loaded via a tab/button in `App.jsx`).

The UI text is in Swedish (e.g. type options `Orkesterlåt`, `Balettlåt`; status options `Aktiv`, `Inaktiv`; the catch-all filter label is `Övrigt`).

The `PUT /api/songs/:id` endpoint receives the **entire** song structure on every save — it deletes all existing DB rows for that song and re-inserts them, and physically deletes files that are no longer present in the request.

### Duration

The `duration` field (seconds, REAL) exists on every row in `files`. It is populated:
- **On upload** — `server/routes/upload.js` probes the file with ffprobe via `fluent-ffmpeg` and returns `duration` alongside `filePath`. Works for any audio or video format; non-media files get `duration = 0`.
- **Client-side fallback** — `uploadUtils.js` also probes audio duration via the browser `Audio` API and passes it in upload metadata. The server-returned value takes precedence if > 0.

Duration is displayed as a badge (`M:SS`) next to the "Spela Musik" and "Visa Video" buttons in `SongDetails.jsx` for any file that has a non-zero duration, regardless of asset type.

### Utility Scripts

All standalone scripts live in `server/scripts/`. Run them inside the backend Docker container:

```bash
docker exec -it <backend-container> node scripts/<script> [--dry-run]
```

| Script | Purpose |
|--------|---------|
| `import.js <source_dir>` | Bulk-import an existing folder structure. Expected layout: one subdir per song with `Inspelningar/`, `Noter/`, `Dans/`, and root-level lyrics files. |
| `transcode-existing-videos.js` | One-time migration: transcode pre-existing videos in unsupported formats (wmv, avi, mkv, mov, flv, m4v) to H.264 MP4 and update DB paths. |
| `backfill-durations.js` | One-time migration: probe duration via ffprobe for all audio/video files in the DB that have `duration = 0`. Skips non-media files (PDFs, images, etc). |
