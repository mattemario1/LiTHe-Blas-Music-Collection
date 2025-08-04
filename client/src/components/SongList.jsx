import React from 'react';
import './SongList.css';

function SongList({ songs, setSelectedSong }) {
  const [activeId, setActiveId] = React.useState(null);

  const handleClick = (song) => {
    setSelectedSong(song);
    setActiveId(song.id);
  };

  return (
    <div className="song-list">
      <h3>Låtar</h3>
      <div className="song-boxes">
        {songs.map(song => (
          <div
            key={song.id}
            className={`song-box ${activeId === song.id ? 'selected' : ''}`}
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
