import { useState } from 'react';
import './SearchAndFilter.css';
import { useAuth } from '../context/AuthContext';

const TYPE_OPTIONS = ['Orkesterlåt', 'Balettlåt', 'Övrigt'];
const STATUS_OPTIONS = ['Aktiv', 'Inaktiv', 'Övrigt'];

function SearchAndFilter({ searchQuery, setSearchQuery, selectedFilters, setSelectedFilters, songs }) {
  const [focused, setFocused] = useState(false);
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

      <button
        className={`lock-btn ${isAdmin ? 'lock-btn-unlocked' : ''}`}
        onClick={handleLockClick}
        title={isAdmin ? 'Logga ut som admin' : 'Logga in som admin'}
        aria-label={isAdmin ? 'Logga ut som admin' : 'Logga in som admin'}
      >
        <i className={`fas ${isAdmin ? 'fa-lock-open' : 'fa-lock'}`}></i>
      </button>

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
