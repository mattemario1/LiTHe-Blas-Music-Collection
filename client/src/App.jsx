// ... (imports remain unchanged)

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ type: '', status: '', album: '' });
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    fetch('/songs')
      .then(res => res.json())
      .then(data => setSongs(data))
      .catch(err => {
        console.error('Failed to load songs:', err);
        alert('Failed to load songs from server.');
      });
  }, []);

  const handlePlayAudio = (fileUrl) => {
    setAudioUrl(fileUrl);
  };

  const handleUpdateSong = (updatedSong) => {
    const updatedSongs = songs.map(song => song.id === updatedSong.id ? updatedSong : song);
    setSongs(updatedSongs);
    setSelectedSong(updatedSong);
  };

  const uploadUpdatedSongs = () => {
    fetch('/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(songs),
    })
      .then(async res => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          alert('Songs uploaded to Google Drive!');
        } catch (err) {
          console.error('Upload failed: Invalid JSON response', text);
          alert('Upload failed: Server returned invalid response.');
        }
      })
      .catch(err => {
        console.error('Upload failed:', err);
        alert('Upload failed: Network or server error.');
      });
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
        <button onClick={handleAddNewSong}>➕ New Song</button>
        <button onClick={handleDeleteSelectedSong} disabled={!selectedSong}>🗑️ Delete Selected Song</button>
        <button onClick={uploadUpdatedSongs}>Upload Updated JSON</button>
      </div>
    </div>
  );
}

export default App;
