import React, { useState } from 'react';
import './App.css';
import SearchAndFilter from './components/SearchAndFilter';
import SongList from './components/SongList';
import SongDetails from './components/SongDetails';
import songsData from './data/songs';
import '@fortawesome/fontawesome-free/css/all.min.css';


function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    type: '',
    status: '',
    album: ''
  });
  const [selectedSong, setSelectedSong] = useState(null);

  const filteredSongs = songsData
    .filter(song => {
      const matchesSearch = song.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedFilters.type || song.type === selectedFilters.type;
      const matchesStatus = !selectedFilters.status || song.status === selectedFilters.status;
      const matchesAlbum = !selectedFilters.album || song.recordings.some(r => r.album === selectedFilters.album);
      return matchesSearch && matchesType && matchesStatus && matchesAlbum;
    })
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name


  return (
    <div className="App">
      <SearchAndFilter
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
      />
      <div className="main-content">
        <SongList songs={filteredSongs} setSelectedSong={setSelectedSong} />
        <SongDetails song={selectedSong} />
      </div>
    </div>
  );
}

export default App;
