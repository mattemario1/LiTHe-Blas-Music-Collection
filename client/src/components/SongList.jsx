import { useState } from 'react';
import './SongList.css';
import AlbumView from './AlbumView';

const TYPE_COLORS = {
  'Orkesterlåt': '#ffeb4f',
  'Balettlåt':   '#1c4386',
  'Marschlåt':   '#5bb85b',
  'Skitsnack':   '#e0943a',
  'Övrigt':      '#aaa',
};

const ASSET_ICONS = [
  { key: 'recordings',  emoji: '🎧', title: 'Inspelningar' },
  { key: 'sheetMusic',  emoji: '🎼', title: 'Noter' },
  { key: 'lyrics',      emoji: '📝', title: 'Texter' },
  { key: 'danceFiles',  emoji: '💃', title: 'Dansfiler' },
  { key: 'otherFiles',  emoji: '📁', title: 'Övrigt' },
];

function hasAsset(song, key) {
  const arr = song[key];
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some(item =>
    Array.isArray(item.parts) ? item.parts.length > 0 : !!item.file_path
  );
}

const getRecordingsFromSong = (song) => {
  return (song.recordings || []).flatMap(item => {
    if (Array.isArray(item.parts)) {
      return item.parts.map(part => ({ ...part, songName: song.name, songId: song.id }));
    }
    return [{ ...item, songName: song.name, songId: song.id }];
  });
};

function SongList({ songs, allSongs, setSelectedSong, selectedSongId, onPlayAudio }) {
  const [view, setView] = useState('songs');

  const handlePlayRandom = () => {
    const allRecordings = songs.flatMap(getRecordingsFromSong).filter(r => r.file_path);

    if (allRecordings.length === 0) {
      alert('Inga inspelningar tillgängliga');
      return;
    }

    const random = allRecordings[Math.floor(Math.random() * allRecordings.length)];
    onPlayAudio(`/file/${random.file_path}`, random.songName, random.album || 'Okänt album', random.date);

    const randomSong = songs.find(s => s.id === random.songId);
    if (randomSong) setSelectedSong(randomSong);
  };

  return (
    <div className="song-list">
      <div className="song-list-header">
        <div className="song-list-tabs">
          <button
            className={`song-list-tab ${view === 'songs' ? 'active' : ''}`}
            onClick={() => setView('songs')}
          >
            Låtar
          </button>
          <button
            className={`song-list-tab ${view === 'albums' ? 'active' : ''}`}
            onClick={() => setView('albums')}
          >
            Album
          </button>
        </div>
        {view === 'songs' && (
          <button
            className="play-random-button"
            onClick={handlePlayRandom}
            title="Spela slumpmässig låt"
          >
            <i className="fas fa-random"></i>
          </button>
        )}
      </div>

      {view === 'songs' ? (
        <div className="song-boxes">
          {songs.map(song => {
            const typeColor = TYPE_COLORS[song.type] || '#ccc';
            const presentAssets = ASSET_ICONS.filter(a => hasAsset(song, a.key));
            return (
              <div
                key={song.id}
                className={`song-box ${selectedSongId === song.id ? 'selected' : ''}`}
                style={{ borderLeft: `4px solid ${typeColor}` }}
                onClick={() => setSelectedSong(song)}
              >
                <div className="song-box-main">
                  <span className="song-box-name">{song.name}</span>
                  <span
                    className={`song-status-dot ${song.is_active ? 'active' : 'inactive'}`}
                    title={song.is_active ? 'Aktiv' : 'Inaktiv'}
                  />
                </div>
                {presentAssets.length > 0 && (
                  <div className="song-asset-icons">
                    {presentAssets.map(a => (
                      <span key={a.key} title={a.title}>{a.emoji}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <AlbumView
          allSongs={allSongs}
          setSelectedSong={setSelectedSong}
          onPlayAudio={onPlayAudio}
        />
      )}
    </div>
  );
}

export default SongList;
