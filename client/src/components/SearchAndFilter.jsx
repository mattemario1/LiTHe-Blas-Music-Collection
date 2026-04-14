import { useState } from 'react';
import './SearchAndFilter.css';

const TYPE_OPTIONS = ['Orkesterlåt', 'Balettlåt', 'Övrigt'];
const STATUS_OPTIONS = ['Aktiv', 'Inaktiv', 'Övrigt'];

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters, songs }) {
  const [focused, setFocused] = useState(false);

  const songNames = songs.map(song => song.name);
  const filteredSuggestions = songNames.filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase()) && searchQuery
  );

  const toggleOption = (field, value) => {
    setSelectedFilters(prev => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  return (
    <div className="search-filter-container">
      <div className="searchbox-wrapper">
        <input
          type="text"
          className="search-box"
          placeholder="🔍 Sök låtar..."
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
          <span className="filter-label">Typ</span>
          <div className="toggle-group">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`filter-toggle-btn ${selectedFilters.shownTypes.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleOption('shownTypes', opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Status</span>
          <div className="toggle-group">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`filter-toggle-btn ${selectedFilters.shownStatuses.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleOption('shownStatuses', opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchAndFilter;
