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
  const [audioInfo, setAudioInfo] = useState({ 
    url: null, 
    songName: '', 
    album: '', 
    date: null
  });

  useEffect(() => {
    fetch('http://localhost:5000/api/songs')
      .then(res => res.json())
      .then(data => {
        console.log("Fetched songs:", data);
        if (Array.isArray(data)) {
          setSongs(data);
        } else {
          console.error("Expected an array but got:", data);
          alert("Failed to load songs.");
        }
      })
      .catch(err => {
        console.error('Failed to load songs:', err);
        alert('Failed to load songs from server.');
      });
  }, []);

  const handlePlayAudio = (fileUrl, songName, album, date) => {
    setAudioInfo({ 
      url: fileUrl, 
      songName, 
      album, 
      date 
    });
  };

  const handleUpdateSong = async (updatedSong) => {
    // Update local state first
    const updatedSongs = songs.map(song => song.id === updatedSong.id ? updatedSong : song);
    setSongs(updatedSongs);
    setSelectedSong(updatedSong);

    // Update song in backend
    try {
      const response = await fetch(`http://localhost:5000/api/songs/${updatedSong.id}`, {
        method: 'PUT', // Ensure this is PUT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedSong.name,
          description: updatedSong.description,
          type: updatedSong.type,
          status: updatedSong.status
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update song on server');
      }
    } catch (err) {
      console.error('Error updating song:', err);
      alert("Failed to update song data on server.");
    }
  };

  const handleAddNewSong = async () => {
    const newSong = {
      name: '',
      description: '',
      type: '',
      status: '',
      recordings: [],
      sheetMusic: [],
      lyrics: [],
      otherFiles: []
    };
    
    try {
      const response = await fetch('http://localhost:5000/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSong)
      });
      
      const data = await response.json();
      const createdSong = { ...newSong, id: data.id };
      
      setSongs(prev => [...prev, createdSong]);
      setSelectedSong(createdSong);
    } catch (err) {
      console.error('Error creating song:', err);
      alert("Failed to create new song.");
    }
  };

  const handleDeleteSelectedSong = async () => {
    if (!selectedSong) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the song "${selectedSong.name || 'Untitled'}"?`
    );
    
    if (confirmDelete) {
      try {
        const response = await fetch(`http://localhost:5000/api/songs/${selectedSong.id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          const updatedSongs = songs.filter(song => song.id !== selectedSong.id);
          setSongs(updatedSongs);
          setSelectedSong(null);
        } else {
          throw new Error('Failed to delete song on server');
        }
      } catch (err) {
        console.error('Error deleting song:', err);
        alert("Failed to delete song.");
      }
    }
  };

  const filteredSongs = songs
    .filter(song => {
      const matchesSearch = song.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedFilters.type || song.type === selectedFilters.type;
      const matchesStatus = !selectedFilters.status || song.status === selectedFilters.status;
      const matchesAlbum = !selectedFilters.album || 
        song.recordings?.some(r => r.album === selectedFilters.album);
      return matchesSearch && matchesType && matchesStatus && matchesAlbum;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={`App ${selectedSong ? 'details-view-active' : ''}`}>
      {selectedSong && (
        <button 
          className="back-button-mobile" 
          onClick={() => setSelectedSong(null)}
          aria-label="Back to song list"
        >
          <i className="fas fa-arrow-left"></i> Back
        </button>
      )}
      
      <SearchAndFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
        songs={songs}
      />
      
      <div className={`main-content ${audioInfo.url ? 'with-player' : ''}`}>
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
      
      <AudioPlayer 
        audioUrl={audioInfo.url} 
        songName={audioInfo.songName}
        songAlbum={audioInfo.album}
        songDate={audioInfo.date}
        onClose={() => setAudioInfo({ 
          url: null, 
          songName: '', 
          album: '', 
          date: null 
        })} 
      />
      
      <div className="action-buttons" style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button onClick={handleAddNewSong}>➕ New Song</button>
        <button onClick={handleDeleteSelectedSong} disabled={!selectedSong}>🗑️ Delete Selected Song</button>
      </div>
    </div>
  );
}

export default App;