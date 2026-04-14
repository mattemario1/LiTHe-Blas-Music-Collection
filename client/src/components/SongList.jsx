import { useState } from 'react';
import './SongList.css';
import AlbumView from './AlbumView';

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
          {songs.map(song => (
            <div
              key={song.id}
              className={`song-box ${selectedSongId === song.id ? 'selected' : ''}`}
              onClick={() => setSelectedSong(song)}
            >
              {song.name}
            </div>
          ))}
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
