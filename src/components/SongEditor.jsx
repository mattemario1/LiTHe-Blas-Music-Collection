// SongEditor.jsx
import React, { useState } from 'react';
import './SongEditor.css';

function FileSection({ title, files, onChange, onUpload, type }) {
  const handleFileChange = (index, field, value) => {
    const updated = [...files];
    updated[index][field] = value;
    onChange(updated);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const newFile = {
        file: URL.createObjectURL(file),
        name: file.name,
        description: '',
        date: new Date().toISOString().split('T')[0],
        tags: [],
      };
      onUpload([...files, newFile]);
    }
  };

  return (
    <div className="file-section">
      <h4>{title}</h4>
      {files.map((file, index) => (
        <div key={index} className="file-edit-box">
          <input
            type="text"
            value={file.description}
            placeholder="Description"
            onChange={(e) => handleFileChange(index, 'description', e.target.value)}
          />
          <input
            type="text"
            value={file.date}
            placeholder="Date"
            onChange={(e) => handleFileChange(index, 'date', e.target.value)}
          />
          <input
            type="text"
            value={file.tags?.join(', ')}
            placeholder="Tags (comma separated)"
            onChange={(e) => handleFileChange(index, 'tags', e.target.value.split(',').map(t => t.trim()))}
          />
          <a href={file.file} target="_blank" rel="noopener noreferrer">View File</a>
        </div>
      ))}
      <input type="file" onChange={handleFileUpload} />
    </div>
  );
}

function SongEditor({ song, onSave, onCancel }) {
  const [editedSong, setEditedSong] = useState({ ...song });

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="song-editor">
      <h2>Edit Song</h2>
      <input
        type="text"
        value={editedSong.name}
        placeholder="Song Name"
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <textarea
        value={editedSong.description}
        placeholder="Description"
        onChange={(e) => handleChange('description', e.target.value)}
      />
      <input
        type="text"
        value={editedSong.type}
        placeholder="Type"
        onChange={(e) => handleChange('type', e.target.value)}
      />
      <input
        type="text"
        value={editedSong.status}
        placeholder="Status"
        onChange={(e) => handleChange('status', e.target.value)}
      />

      <FileSection
        title="🎧 Recordings"
        files={editedSong.recordings || []}
        onChange={(files) => handleChange('recordings', files)}
        onUpload={(files) => handleChange('recordings', files)}
        type="recording"
      />
      <FileSection
        title="🎼 Sheet Music"
        files={editedSong.sheetMusic || []}
        onChange={(files) => handleChange('sheetMusic', files)}
        onUpload={(files) => handleChange('sheetMusic', files)}
        type="sheet"
      />
      <FileSection
        title="📝 Lyrics"
        files={editedSong.lyrics || []}
        onChange={(files) => handleChange('lyrics', files)}
        onUpload={(files) => handleChange('lyrics', files)}
        type="lyrics"
      />

      <div className="editor-actions">
        <button onClick={() => onSave(editedSong)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default SongEditor;
