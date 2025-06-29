import React, { useState } from 'react';
import './SongEditor.css';

function FileEditor({ file, onChange, onRemove, type, collections, onAddToCollection }) {
  const handleFieldChange = (field, value) => {
    onChange({ ...file, [field]: value });
  };

  return (
    <div className="file-edit-box">
      {type === 'recording' && (
        <input
          type="text"
          value={file.album || ''}
          placeholder="Album"
          onChange={(e) => handleFieldChange('album', e.target.value)}
        />
      )}
      {type === 'sheet' && (
        <input
          type="text"
          value={file.instrument || ''}
          placeholder="Instrument"
          onChange={(e) => handleFieldChange('instrument', e.target.value)}
        />
      )}
      {type === 'lyrics' && (
        <input
          type="text"
          value={file.name || ''}
          placeholder="Lyrics Name"
          onChange={(e) => handleFieldChange('name', e.target.value)}
        />
      )}
      <input
        type="text"
        value={file.description || ''}
        placeholder="Description"
        onChange={(e) => handleFieldChange('description', e.target.value)}
      />
      <input
        type="text"
        value={file.date || ''}
        placeholder="Date"
        onChange={(e) => handleFieldChange('date', e.target.value)}
      />
      <input
        type="text"
        value={file.tags?.join(', ') || ''}
        placeholder="Tags (comma separated)"
        onChange={(e) => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()))}
      />
      <a href={file.file} target="_blank" rel="noopener noreferrer">View File</a>
      {collections.length > 0 && (
        <select onChange={(e) => onAddToCollection(file, e.target.value)}>
          <option value="">Add to Collection</option>
          {collections.map((c, i) => (
            <option key={i} value={c.collection}>{c.collection}</option>
          ))}
        </select>
      )}
      <button onClick={onRemove}>Remove from Song</button>
    </div>
  );
}

function CollectionEditor({ collection, onUpdate, onRemove, type, onRemoveFile, onRemoveFromCollection }) {
  const updateFile = (index, updatedFile) => {
    const updatedParts = [...collection.parts];
    updatedParts[index] = updatedFile;
    onUpdate({ ...collection, parts: updatedParts });
  };

  return (
    <div className="collection-box">
      <div className="collection-header-edit">
        <input
          type="text"
          value={collection.collection}
          placeholder="Collection Name"
          onChange={(e) => onUpdate({ ...collection, collection: e.target.value })}
        />
        <input
          type="text"
          value={collection.description}
          placeholder="Collection Description"
          onChange={(e) => onUpdate({ ...collection, description: e.target.value })}
        />
        <button onClick={onRemove}>Remove Collection</button>
      </div>
      {collection.parts.map((file, index) => (
        <div key={index}>
          <FileEditor
            file={file}
            onChange={(updated) => updateFile(index, updated)}
            onRemove={() => onRemoveFile(file, collection.collection)}
            type={type}
            collections={[]}
            onAddToCollection={() => {}}
          />
          <button
            className="remove-from-collection"
            onClick={() => onRemoveFromCollection(file, collection.collection)}
          >
            Remove from Collection
          </button>
        </div>
      ))}
    </div>
  );
}

function FileSection({ title, files, onChange, type }) {
  const collections = files.filter(f => Array.isArray(f.parts));
  const ungrouped = files.filter(f => !Array.isArray(f.parts));

  const updateCollection = (index, updated) => {
    const updatedFiles = [...files];
    updatedFiles[index] = updated;
    onChange(updatedFiles);
  };

  const removeCollection = (index) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    onChange(updatedFiles);
  };

  const removeFileFromSong = (fileToRemove, fromCollection = null) => {
    if (fromCollection) {
      const updatedCollections = collections.map(c => {
        if (c.collection === fromCollection) {
          return { ...c, parts: c.parts.filter(f => f.file !== fileToRemove.file) };
        }
        return c;
      });
      onChange([...updatedCollections, ...ungrouped]);
    } else {
      const updatedUngrouped = ungrouped.filter(f => f.file !== fileToRemove.file);
      onChange([...collections, ...updatedUngrouped]);
    }
  };

  const removeFromCollection = (file, collectionName) => {
    const updatedCollections = collections.map(c => {
      if (c.collection === collectionName) {
        return { ...c, parts: c.parts.filter(f => f.file !== file.file) };
      }
      return c;
    });
    const updatedUngrouped = [...ungrouped, file];
    onChange([...updatedCollections, ...updatedUngrouped]);
  };

  const addToCollection = (file, collectionName) => {
    const updatedCollections = collections.map(c => {
      if (c.collection === collectionName) {
        return { ...c, parts: [...c.parts, file] };
      }
      return c;
    });
    const updatedUngrouped = ungrouped.filter(f => f.file !== file.file);
    onChange([...updatedCollections, ...updatedUngrouped]);
  };

  const addCollection = () => {
    const newCollection = {
      collection: 'New Collection',
      description: '',
      parts: []
    };
    onChange([...files, newCollection]);
  };

  const addFile = () => {
    const newFile = {
      file: '',
      description: '',
      date: '',
      tags: [],
      ...(type === 'recording' ? { album: '' } : {}),
      ...(type === 'sheet' ? { instrument: '' } : {})
    };
    onChange([...files, newFile]);
  };

  return (
    <div className="file-section">
      <h4>{title}</h4>
      {collections.map((collection, index) => (
        <CollectionEditor
          key={index}
          collection={collection}
          onUpdate={(updated) => updateCollection(index, updated)}
          onRemove={() => removeCollection(index)}
          type={type}
          onRemoveFile={removeFileFromSong}
          onRemoveFromCollection={removeFromCollection}
        />
      ))}
      {ungrouped.map((file, index) => (
        <FileEditor
          key={index}
          file={file}
          onChange={(updated) => {
            const updatedUngrouped = [...ungrouped];
            updatedUngrouped[index] = updated;
            onChange([...collections, ...updatedUngrouped]);
          }}
          onRemove={() => removeFileFromSong(file)}
          type={type}
          collections={collections}
          onAddToCollection={addToCollection}
        />
      ))}
      <div className="section-actions">
        <button onClick={addCollection}>Create New Collection</button>
        <button onClick={addFile}>Add New File</button>
      </div>
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
      <select
        value={editedSong.type}
        onChange={(e) => handleChange('type', e.target.value)}
      >
        <option value="">Select Type</option>
        <option value="Orkesterlåt">Orkesterlåt</option>
        <option value="Balettlåt">Balettlåt</option>
        <option value="Övrigt">Övrigt</option>
      </select>
      <select
        value={editedSong.status}
        onChange={(e) => handleChange('status', e.target.value)}
      >
        <option value="">Select Status</option>
        <option value="Aktiv">Aktiv</option>
        <option value="Gammal">Gammal</option>
        <option value="Övrigt">Övrigt</option>
      </select>

      <FileSection
        title="🎧 Recordings"
        files={editedSong.recordings || []}
        onChange={(files) => handleChange('recordings', files)}
        type="recording"
      />
      <FileSection
        title="🎼 Sheet Music"
        files={editedSong.sheetMusic || []}
        onChange={(files) => handleChange('sheetMusic', files)}
        type="sheet"
      />
      <FileSection
        title="📝 Lyrics"
        files={editedSong.lyrics || []}
        onChange={(files) => handleChange('lyrics', files)}
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
