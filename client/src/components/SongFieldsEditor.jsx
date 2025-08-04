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
        <option value="Övrigt">Övrigt</option>
      </select>
      <select
        value={song.status}
        onChange={(e) => onChange('status', e.target.value)}
      >
        <option value="">Select Status</option>
        <option value="Aktiv">Aktiv</option>
        <option value="Inaktiv">Inaktiv</option>
        <option value="Övrigt">Övrigt</option>
      </select>
    </>
  );
}

export default SongFieldsEditor;
