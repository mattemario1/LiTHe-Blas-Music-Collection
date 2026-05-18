import { useState, useEffect, useRef } from 'react';
import ImageModal from './ImageModal';
import { useAuth } from '../context/AuthContext';

// ── Album detail ─────────────────────────────────────────────────────────────

function AlbumDetail({ album, allSongs, onBack, setSelectedSong, onPlayAudio, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const { isAdmin } = useAuth();
  const [year, setYear] = useState(album.year || '');
  const [description, setDescription] = useState(album.description || '');
  const [songOrder, setSongOrder] = useState(album.songs.map(s => s.song_id));
  const [imageModalUrl, setImageModalUrl] = useState(null);
  const dragIndex = useRef(null);
  const dragOverIndex = useRef(null);

  useEffect(() => {
    setYear(album.year || '');
    setDescription(album.description || '');
    setSongOrder(album.songs.map(s => s.song_id));
  }, [album]);

  const handleSaveEdit = async () => {
    await fetch(`/api/albums/${encodeURIComponent(album.name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, description, song_order: songOrder })
    });
    setEditing(false);
    onRefresh();
  };

  const handleCancelEdit = () => {
    setYear(album.year || '');
    setDescription(album.description || '');
    setSongOrder(album.songs.map(s => s.song_id));
    setEditing(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`/api/albums/${encodeURIComponent(album.name)}/cover`, {
      method: 'POST',
      body: formData
    });
    onRefresh();
  };

  const handleDragStart = (index) => {
    dragIndex.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverIndex.current = index;
  };

  const handleDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from !== null && to !== null && from !== to) {
      const newOrder = [...songOrder];
      const [moved] = newOrder.splice(from, 1);
      newOrder.splice(to, 0, moved);
      setSongOrder(newOrder);
    }
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  // Build an ordered list of song objects based on songOrder
  const songById = Object.fromEntries(album.songs.map(s => [s.song_id, s]));
  const orderedSongs = songOrder.map(id => songById[id]).filter(Boolean);

  return (
    <div className="album-detail">
      {imageModalUrl && (
        <ImageModal imageUrl={imageModalUrl} onClose={() => setImageModalUrl(null)} />
      )}

      <button className="album-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left"></i> Tillbaka
      </button>

      <div className="album-detail-header">
        {editing ? (
          <label className="album-cover-upload-label" title="Klicka för att byta omslag">
            {album.cover_path ? (
              <img src={`/file/${album.cover_path}`} alt={album.name} className="album-detail-img" />
            ) : (
              <div className="album-cover-placeholder-large">
                <i className="fas fa-camera"></i>
                <span>Ladda upp</span>
              </div>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
          </label>
        ) : (
          <div
            className="album-cover-upload-label"
            onClick={() => album.cover_path && setImageModalUrl(`/file/${album.cover_path}`)}
            style={{ cursor: album.cover_path ? 'zoom-in' : 'default' }}
          >
            {album.cover_path ? (
              <img src={`/file/${album.cover_path}`} alt={album.name} className="album-detail-img" />
            ) : (
              <div className="album-cover-placeholder-large">
                <i className="fas fa-music"></i>
              </div>
            )}
          </div>
        )}

        <div className="album-detail-info">
          <div className="album-detail-name">{album.name}</div>

          {editing ? (
            <div className="album-edit-form">
              <input
                type="text"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="År"
                className="album-edit-input"
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Beskrivning"
                className="album-edit-textarea"
              />
              <div className="album-edit-actions">
                <button onClick={handleSaveEdit}>Spara</button>
                <button onClick={handleCancelEdit}>Avbryt</button>
              </div>
            </div>
          ) : (
            <>
              {album.year && <div className="album-meta-year">{album.year}</div>}
              {album.description && <div className="album-meta-desc" style={{ whiteSpace: 'pre-wrap' }}>{album.description}</div>}
              {isAdmin && (
                <button className="album-edit-btn" onClick={() => setEditing(true)}>
                  <i className="fas fa-pen"></i> Redigera
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="album-song-list">
        {orderedSongs.map((albumSong, index) => {
          const fullSong = allSongs.find(s => s.id === albumSong.song_id);
          return (
            <div
              key={albumSong.song_id}
              className="album-song-item"
              draggable={editing}
              onDragStart={editing ? () => handleDragStart(index) : undefined}
              onDragEnter={editing ? () => handleDragEnter(index) : undefined}
              onDragEnd={editing ? handleDragEnd : undefined}
              onDragOver={editing ? (e) => e.preventDefault() : undefined}
            >
              {editing && (
                <span className="album-drag-handle" title="Dra för att ändra ordning">
                  <i className="fas fa-grip-vertical"></i>
                </span>
              )}
              <span
                className="album-song-name"
                onClick={() => !editing && fullSong && setSelectedSong(fullSong)}
                title={editing ? undefined : 'Visa låt'}
                style={{ cursor: editing ? 'default' : 'pointer' }}
              >
                {albumSong.song_name}
              </span>
              <div className="album-song-plays">
                {albumSong.recordings.map(rec => (
                  <button
                    key={rec.id}
                    className="album-play-btn"
                    title={rec.date || 'Spela'}
                    onClick={() => onPlayAudio(
                      `/file/${rec.file_path}`,
                      albumSong.song_name,
                      album.name,
                      rec.date
                    )}
                  >
                    <i className="fas fa-play"></i>
                    {rec.date && <span className="play-btn-date">{rec.date}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Album list ────────────────────────────────────────────────────────────────

function AlbumView({ allSongs, setSelectedSong, onPlayAudio }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/albums');
      const data = await res.json();
      setAlbums(data);
      // Keep the selected album in sync if it's open
      if (selectedAlbum) {
        const updated = data.find(a => a.name === selectedAlbum.name);
        setSelectedAlbum(updated || null);
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount (i.e. every time the Albums tab becomes active)
  useEffect(() => { fetchAlbums(); }, []);

  if (loading) return <div className="album-loading">Laddar album...</div>;

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        allSongs={allSongs}
        onBack={() => setSelectedAlbum(null)}
        setSelectedSong={setSelectedSong}
        onPlayAudio={onPlayAudio}
        onRefresh={fetchAlbums}
      />
    );
  }

  return (
    <div className="album-list">
      {albums.length === 0 && (
        <div className="album-empty">Inga album hittades. Lägg till album-namn på inspelningar för att se dem här.</div>
      )}
      {albums.map(album => (
        <div key={album.name} className="album-box" onClick={() => setSelectedAlbum(album)}>
          <div className="album-cover-thumb">
            {album.cover_path ? (
              <img src={`/file/${album.cover_path}`} alt={album.name} />
            ) : (
              <div className="album-cover-placeholder">
                <i className="fas fa-music"></i>
              </div>
            )}
          </div>
          <div className="album-info">
            <div className="album-name">{album.name}</div>
            {album.year && <div className="album-year">{album.year}</div>}
            <div className="album-song-count">
              {album.songs.length} låt{album.songs.length !== 1 ? 'ar' : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AlbumView;
