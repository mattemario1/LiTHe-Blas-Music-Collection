import { useState, useEffect } from 'react';
import './App.css';
import SearchAndFilter from './components/SearchAndFilter';
import SongList from './components/SongList';
import SongDetails from './components/SongDetails';
import AudioPlayer from './components/AudioPlayer';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppInner() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    shownTypes: ['Orkesterlåt', 'Balettlåt', 'Övrigt'],
    shownStatuses: ['Aktiv', 'Inaktiv', 'Övrigt']
  });
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [audioInfo, setAudioInfo] = useState({
    url: null,
    songName: '',
    album: '',
    date: null
  });

  // Load all songs on startup
  useEffect(() => {
    fetch('/api/songs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSongs(data);
        else console.error('Expected array from /api/songs:', data);
      })
      .catch(err => {
        console.error('Failed to load songs:', err);
        alert('Failed to load songs');
      });
  }, []);

  const handlePlayAudio = (fileUrl, songName, album, date) => {
    setAudioInfo({ url: fileUrl, songName, album, date });
  };

  // Called by SongDetails after a successful save
  // The server returns the full updated song so we just replace it in state
  const handleUpdateSong = (updatedSong) => {
    setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
    setSelectedSong(updatedSong);
  };

  const handleAddNewSong = async () => {
    try {
      const response = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', description: '', type: '', status: '' })
      });

      if (!response.ok) throw new Error(await response.text());

      const newSong = await response.json();
      setSongs(prev => [...prev, newSong]);
      setSelectedSong(newSong);
    } catch (err) {
      console.error('Error creating song:', err);
      alert(`Failed to create song: ${err.message}`);
    }
  };

  const handleDeleteSelectedSong = async () => {
    if (!selectedSong) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedSong.name || 'Untitled'}"?`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/songs/${selectedSong.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete song');

      setSongs(prev => prev.filter(s => s.id !== selectedSong.id));
      setSelectedSong(null);
    } catch (err) {
      console.error('Error deleting song:', err);
      alert('Failed to delete song.');
    }
  };

  const TYPE_OPTIONS = ['Orkesterlåt', 'Balettlåt'];
  const STATUS_OPTIONS = ['Aktiv', 'Inaktiv'];

  const getFilteredSongs = () => {
    return songs
      .filter(song => {
        const matchesSearch = song.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = TYPE_OPTIONS.includes(song.type)
          ? selectedFilters.shownTypes.includes(song.type)
          : selectedFilters.shownTypes.includes('Övrigt');
        const matchesStatus = STATUS_OPTIONS.includes(song.status)
          ? selectedFilters.shownStatuses.includes(song.status)
          : selectedFilters.shownStatuses.includes('Övrigt');
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredSongs = getFilteredSongs();

  return (
    <div className={`App ${selectedSong ? 'details-view-active' : ''}`}>
      {selectedSong && (
        <button
          className="back-button-mobile"
          onClick={() => setSelectedSong(null)}
          aria-label="Back to song list"
        >
          <i className="fas fa-arrow-left"></i> Back to List
        </button>
      )}

        <SearchAndFilter
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          songs={songs}
        />

        {/* NEW WRAPPER STARTS HERE */}
        <div className="app-body-wrapper">
          <div className={`main-content ${audioInfo.url ? 'with-player' : ''}`}>
            <SongList
              songs={filteredSongs}
              allSongs={songs}
              setSelectedSong={setSelectedSong}
              selectedSongId={selectedSong?.id || null}
              onPlayAudio={handlePlayAudio}
            />
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

          {isAdmin && (
            <div className="action-buttons" style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button onClick={handleAddNewSong}>➕ New Song</button>
              <button onClick={handleDeleteSelectedSong} disabled={!selectedSong}>
                🗑️ Delete Selected Song
              </button>
              <a href="/api/backup" download>
                <button type="button">💾 Download Backup</button>
              </a>
            </div>
          )}
        </div>
        {/* NEW WRAPPER ENDS HERE */}

        <AudioPlayer
          audioUrl={audioInfo.url}
          songName={audioInfo.songName}
          songAlbum={audioInfo.album}
          songDate={audioInfo.date}
          onClose={() => setAudioInfo({ url: null, songName: '', album: '', date: null })}
        />
      </div>
    );
  }

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
