import React, { useState } from 'react';
import './SearchAndFilter.css';

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters, songs }) {
  const [focused, setFocused] = useState(false);

  const albums = Array.from(
      new Set(
        songs.flatMap(song => 
          song.recordings.flatMap(recording => 
            recording.parts 
              ? recording.parts.map(part => part.album)  // Get albums from collection parts
              : recording.album  // Get album from standalone recording
          )
        )
      )
    ).filter(album => album); // Remove empty values
  const songNames = songs.map(song => song.name);
  const filteredSuggestions = songNames.filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase()) && searchQuery
  );

  const handleChange = (field, value) => {
    setSelectedFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="search-filter-container">
      <div className="searchbox-wrapper">
        <input
          type="text"
          className="search-box"
          placeholder="🔍 Search songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {searchQuery && (
          <button
            className="clear-button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
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

      <div className="filter-panel">
        <div className="filter-group">
          <label>Type</label>
          <select onChange={(e) => handleChange('type', e.target.value)} defaultValue="">
            <option value="">-- Select --</option>
            <option value="Orkesterlåt">Orkesterlåt</option>
            <option value="Balettlåt">Balettlåt</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select onChange={(e) => handleChange('status', e.target.value)} defaultValue="">
            <option value="">-- Select --</option>
            <option value="Aktiv">Aktiv</option>
            <option value="Gammal">Gammal</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Album</label>
          <select onChange={(e) => handleChange('album', e.target.value)} defaultValue="">
            <option value="">-- Select --</option>
            {albums.map((album, index) => (
              <option key={index} value={album}>{album}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default SearchAndFilter;
