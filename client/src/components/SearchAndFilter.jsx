import { useState } from 'react';
import './SearchAndFilter.css';
import { useAuth } from '../context/AuthContext';

const MAIN_TYPE_OPTIONS     = ['Orkesterlåt', 'Balettlåt', 'Marschlåt'];
const EXTENDED_TYPE_OPTIONS = ['Skitsnack', 'Övrigt'];
const ASSET_FILTERS = [
  { key: 'recordings', label: 'Inspelningar' },
  { key: 'sheetMusic', label: 'Noter' },
  { key: 'lyrics',     label: 'Text' },
  { key: 'danceFiles', label: 'Dans' },
  { key: 'otherFiles', label: 'Andra filer' },
];
const PROP_FILTERS = [
  { key: 'in_marching_binder', label: 'I marschpärmen' },
  { key: 'has_a5',             label: 'A5-format' },
];

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters, songs, setSelectedSong }) {
  const [focused, setFocused] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [lockError, setLockError] = useState(false);
  const { isAdmin, login, logout } = useAuth();

  const handleLockClick = () => {
    if (isAdmin) {
      logout();
    } else {
      setPasswordInput('');
      setLockError(false);
      setShowLockModal(true);
    }
  };

  const handleLockSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(passwordInput);
    if (ok) {
      setShowLockModal(false);
      setPasswordInput('');
      setLockError(false);
    } else {
      setLockError(true);
    }
  };

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

  const hiddenActiveCount = selectedFilters.requiredAssets.length + selectedFilters.requiredProps.length;

  return (
    <div className="search-filter-container">
      {showLockModal && (
        <div className="lock-modal-overlay" onClick={() => setShowLockModal(false)}>
          <div className="lock-modal" onClick={e => e.stopPropagation()}>
            <h3>Adminlösenord</h3>
            <form onSubmit={handleLockSubmit}>
              <input
                type="password"
                className="lock-modal-input"
                placeholder="Lösenord"
                value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setLockError(false); }}
                autoFocus
              />
              {lockError && <div className="lock-modal-error">Fel lösenord</div>}
              <div className="lock-modal-actions">
                <button type="button" onClick={() => setShowLockModal(false)}>Avbryt</button>
                <button type="submit">Lås upp</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="search-row">
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
                  onClick={() => {
                    const song = songs.find(s => s.name === name);
                    if (song && setSelectedSong) setSelectedSong(song);
                    setSearchQuery('');
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className={`lock-btn ${isAdmin ? 'lock-btn-unlocked' : ''}`}
          onClick={handleLockClick}
          title={isAdmin ? 'Logga ut som admin' : 'Logga in som admin'}
          aria-label={isAdmin ? 'Logga ut som admin' : 'Logga in som admin'}
        >
          <i className={`fas ${isAdmin ? 'fa-lock-open' : 'fa-lock'}`}></i>
        </button>
      </div>

      <div className="filter-panel">
        {showMore && (
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <div className="toggle-group">
              <button
                className={`filter-toggle-btn ${selectedFilters.shownStatuses.includes('Aktiv') ? 'active' : ''}`}
                onClick={() => toggleOption('shownStatuses', 'Aktiv')}
              >
                Aktiv
              </button>
            </div>
          </div>
        )}
        <div className={showMore ? 'filter-group' : ''}>
          {showMore && <span className="filter-label">Typ</span>}
          <div className="toggle-group">
          {!showMore && (
            <button
              className={`filter-toggle-btn ${selectedFilters.shownStatuses.includes('Aktiv') ? 'active' : ''}`}
              onClick={() => toggleOption('shownStatuses', 'Aktiv')}
            >
              Aktiv
            </button>
          )}
          {MAIN_TYPE_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`filter-toggle-btn ${selectedFilters.shownTypes.includes(opt) ? 'active' : ''}`}
              onClick={() => toggleOption('shownTypes', opt)}
            >
              {opt}
            </button>
          ))}
          {showMore && EXTENDED_TYPE_OPTIONS.map(opt => (
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

        {showMore && (
          <>
            <div className="filter-group">
              <span className="filter-label">Innehåll</span>
              <div className="toggle-group">
                {ASSET_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`filter-toggle-btn ${selectedFilters.requiredAssets.includes(key) ? 'active' : ''}`}
                    onClick={() => toggleOption('requiredAssets', key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Egenskaper</span>
              <div className="toggle-group">
                {PROP_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`filter-toggle-btn ${selectedFilters.requiredProps.includes(key) ? 'active' : ''}`}
                    onClick={() => toggleOption('requiredProps', key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="more-filters-btn" onClick={() => setShowMore(p => !p)}>
          {showMore
            ? 'Färre filter ▲'
            : `Fler filter ▼${hiddenActiveCount > 0 ? ` (${hiddenActiveCount})` : ''}`}
        </button>
      </div>
    </div>
  );
}

export default SearchAndFilter;
