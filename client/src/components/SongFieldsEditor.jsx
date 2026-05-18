// SongFieldsEditor.jsx
import React from 'react';

function SongFieldsEditor({ song, onChange }) {
  return (
    <>
      <input
        type="text"
        value={song.name}
        placeholder="Song Name"
        onChange={(e) => onChange('name', e.target.value)}
      />
      <textarea
        value={song.description}
        placeholder="Description"
        onChange={(e) => onChange('description', e.target.value)}
      />
      <select
        value={song.type}
        onChange={(e) => onChange('type', e.target.value)}
      >
        <option value="">Select Type</option>
        <option value="Orkesterlåt">Orkesterlåt</option>
        <option value="Balettlåt">Balettlåt</option>
        <option value="Marschlåt">Marschlåt</option>
        <option value="Skitsnack">Skitsnack</option>
        <option value="Övrigt">Övrigt</option>
      </select>
      <div className="song-properties">
        {[
          { field: 'is_active',          label: 'Aktiv' },
          { field: 'in_marching_binder', label: 'I marschpärmen' },
          { field: 'has_a5',             label: 'A5-format' },
        ].map(({ field, label }) => (
          <label key={field} className="property-checkbox">
            <input
              type="checkbox"
              checked={!!song[field]}
              onChange={(e) => onChange(field, e.target.checked ? 1 : 0)}
            />
            {label}
          </label>
        ))}
      </div>
    </>
  );
}

export default SongFieldsEditor;
