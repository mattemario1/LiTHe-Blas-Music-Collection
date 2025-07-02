import React, { useState } from 'react';
import './SearchAndFilter.css';
import songsData from '../data/songs';

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters }) {
  const [showFilters, setShowFilters] = useState(false);

  const albums = Array.from(
    new Set(songsData.flatMap(song => song.recordings.map(r => r.album)))
  );

  const handleChange = (field, value) => {
    setSelectedFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="search-filter-container">
      <input
        className="search-box"
        type="text"
        placeholder="🔍 Search songs..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
        🎛️ Filters
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Type</label>
            <select onChange={(e) => handleChange('type', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              <option value="Orkesterlåt">Orkesterlåt</option>
              <option value="Balettlåt">Balettlåt</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select onChange={(e) => handleChange('status', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              <option value="Aktiv">Aktiv</option>
              <option value="Gammal">Gammal</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Album</label>
            <select onChange={(e) => handleChange('album', e.target.value)} defaultValue="">
              <option value="">-- Select --</option>
              {albums.map(album => (
                <option key={album} value={album}>{album}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchAndFilter;
