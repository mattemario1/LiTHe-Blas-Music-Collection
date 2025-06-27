import React, { useState, useEffect } from 'react';
import './App.css';
import SearchAndFilter from './components/SearchAndFilter';
import SongList from './components/SongList';
import SongDetails from './components/SongDetails';
import AudioPlayer from './components/AudioPlayer';
import '@fortawesome/fontawesome-free/css/all.min.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ type: '', status: '', album: '' });
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    fetch('/songs.json')
      .then(res => res.json())
      .then(data => setSongs(data))
      .catch(err => console.error('Failed to load songs:', err));
  }, []);

  const handlePlayAudio = (fileUrl) => {
    setAudioUrl(fileUrl);
  };

  const handleUpdateSong = (updatedSong) => {
    const updatedSongs = songs.map(song => song.id === updatedSong.id ? updatedSong : song);
    setSongs(updatedSongs);
    setSelectedSong(updatedSong);
  };

  const downloadUpdatedSongs = () => {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'songs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSongs = songs
    .filter(song => {
      const matchesSearch = song.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedFilters.type || song.type === selectedFilters.type;
      const matchesStatus = !selectedFilters.status || song.status === selectedFilters.status;
      const matchesAlbum = !selectedFilters.album || song.recordings?.some(r => r.album === selectedFilters.album);
      return matchesSearch && matchesType && matchesStatus && matchesAlbum;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="App">
      <SearchAndFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <div className={`main-content ${audioUrl ? 'with-player' : ''}`}>
        <SongList songs={filteredSongs} setSelectedSong={setSelectedSong} />
        <SongDetails
          song={selectedSong}
          onPlayAudio={handlePlayAudio}
          onUpdateSong={handleUpdateSong}
        />
      </div>
      <AudioPlayer audioUrl={audioUrl} onClose={() => setAudioUrl(null)} />
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button onClick={downloadUpdatedSongs}>Download Updated JSON</button>
      </div>
    </div>
  );
}

export default App;
