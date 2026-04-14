import React from 'react';
import './SongList.css';

const getRecordingsFromSong = (song) => {
  return (song.recordings || []).flatMap(item => {
    if (Array.isArray(item.parts)) {
      return item.parts.map(part => ({ ...part, songName: song.name, songId: song.id }));
    }
    return [{ ...item, songName: song.name, songId: song.id }];
  });
};

function SongList({ songs, setSelectedSong, selectedSongId, onPlayAudio }) {
  const handleClick = (song) => {
    setSelectedSong(song);
  };

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
        <h3>Låtar</h3>
        <button
          className="play-random-button"
          onClick={handlePlayRandom}
          title="Spela slumpmässig låt"
        >
          <i className="fas fa-random"></i>
        </button>
      </div>
      <div className="song-boxes">
        {songs.map(song => (
          <div
            key={song.id}
            className={`song-box ${selectedSongId === song.id ? 'selected' : ''}`}
            onClick={() => handleClick(song)}
          >
            {song.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SongList;