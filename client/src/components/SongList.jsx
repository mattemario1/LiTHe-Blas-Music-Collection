import React from 'react';
import './SongList.css';

function SongList({ songs, setSelectedSong, selectedSongId, onPlayRandom }) {
  const handleClick = (song) => {
    setSelectedSong(song);
  };

  return (
    <div className="song-list">
      <div className="song-list-header">
        <h3>Låtar</h3>
        <button 
          className="play-random-button" 
          onClick={onPlayRandom}
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