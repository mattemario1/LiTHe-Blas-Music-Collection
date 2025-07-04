import React, { useState } from 'react';
import './SearchAndFilter.css';
import songsData from '../data/songs';

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters, songs }) {
  const [showFilters, setShowFilters] = useState(false);
  const [focused, setFocused] = useState(false);

  const albums = Array.from(new Set(songs.flatMap(song => song.recordings.map(r => r.album))));
  const songNames = songs.map(song => song.name);
  const filteredSuggestions = songNames.filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase()) && searchQuery
  );


  const handleChange = (field, value) => {
    setSelectedFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="search-filter-container" style={{ position: 'relative' }}>
      <div className="searchbox-wrapper">
        <input
          className="search-box"
          type="text"
          placeholder="🔍 Search songs..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {focused && filteredSuggestions.length > 0 && (
          <div className="autocomplete-list">
            {filteredSuggestions.map((name, index) => (
              <div
                key={index}
                className="autocomplete-item"
                onClick={() => setSearchQuery(name)}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
        🎛️ Filters
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Type</label>
            <select onChange={e => handleChange('type', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              <option value="Orkesterlåt">Orkesterlåt</option>
              <option value="Balettlåt">Balettlåt</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select onChange={e => handleChange('status', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              <option value="Aktiv">Aktiv</option>
              <option value="Gammal">Gammal</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Album</label>
            <select onChange={e => handleChange('album', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              {albums.map((album, index) => (
                <option key={index} value={album}>{album}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchAndFilter;
