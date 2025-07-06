import React, { useState, useEffect } from 'react';
import './App.css';
import SearchAndFilter from './components/SearchAndFilter';
import SongList from './components/SongList';
import SongDetails from './components/SongDetails';
import AudioPlayer from './components/AudioPlayer';
import { uploadSongsJson } from './components/uploadUtils';
import '@fortawesome/fontawesome-free/css/all.min.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ type: '', status: '', album: '' });
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/songs')
      .then(res => res.json())
      .then(data => {
        console.log("Fetched songs:", data);
        if (Array.isArray(data)) {
          setSongs(data);
        } else {
          console.error("Expected an array but got:", data);
          alert("Failed to load songs: songs.json not found or invalid.");
        }
      })
      .catch(err => {
        console.error('Failed to load songs:', err);
        alert('Failed to load songs from server.');
      });
  }, []);

  const handlePlayAudio = (fileUrl) => {
    setAudioUrl(fileUrl);
  };

  const handleUpdateSong = async (updatedSong) => {
    const updatedSongs = songs.map(song => song.id === updatedSong.id ? updatedSong : song);
    setSongs(updatedSongs);
    setSelectedSong(updatedSong);

    try {
      await uploadSongsJson(updatedSongs); // Simple call; no progress bar here
    } catch (err) {
      alert("Failed to upload updated song data.");
    }
  };

  const handleAddNewSong = () => {
    const newSong = {
      id: Date.now(),
      name: '',
      description: '',
      type: '',
      status: '',
      recordings: [],
      sheetMusic: [],
      lyrics: []
    };
    setSongs(prev => [...prev, newSong]);
    setSelectedSong(newSong);
  };

  const handleDeleteSelectedSong = () => {
    if (!selectedSong) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete the song "${selectedSong.name || 'Untitled'}"?`);
    if (confirmDelete) {
      const updatedSongs = songs.filter(song => song.id !== selectedSong.id);
      setSongs(updatedSongs);
      setSelectedSong(null);
    }
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
    // Add a dynamic class here based on whether a song is selected
    <div className={`App ${selectedSong ? 'details-view-active' : ''}`}>
      <SearchAndFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
        songs={songs}
      />
      <div className={`main-content ${audioUrl ? 'with-player' : ''}`}>
        <SongList songs={filteredSongs} setSelectedSong={setSelectedSong} />
        {selectedSong && (
          <SongDetails
            song={selectedSong}
            onPlayAudio={handlePlayAudio}
            onUpdateSong={handleUpdateSong}
            songs={songs}
            setSongs={setSongs}
            onBack={() => setSelectedSong(null)}
          />
        )}
      </div>
      <AudioPlayer audioUrl={audioUrl} onClose={() => setAudioUrl(null)} />
      {/* Add a class name to this container so we can hide it */}
      <div className="action-buttons" style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button onClick={handleAddNewSong}>➕ New Song</button>
        <button onClick={handleDeleteSelectedSong} disabled={!selectedSong}>🗑️ Delete Selected Song</button>
      </div>
    </div>
  );
}

export default App;