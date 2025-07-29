// SongAssetEditor.jsx
import React from 'react';

const getId = () => Date.now().toString();

function FileEditor({ file, onChange, onRemove, type, collections, onAddToCollection, songs }) {
  const [focusedField, setFocusedField] = React.useState(null);
  const handleChange = (field, value) => onChange({ ...file, [field]: value });

  const handleFileInput = (e) => {
    const uploaded = e.target.files[0];
    if (!uploaded) return;
    
    if (uploaded.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit');
      return;
    }
    
    handleChange('localFile', uploaded);
  };

  const albumOptions = Array.from(new Set(
    (songs ?? []).flatMap(song => song.recordings.flatMap(rec => 
      rec.parts ? rec.parts.map(p => p.album) : [rec.album]
    ).filter(Boolean))
  ));
  
  const instrumentOptions = Array.from(new Set(
    (songs ?? []).flatMap(song => song.sheetMusic.flatMap(sheet => 
      sheet.parts ? sheet.parts.map(p => p.instrument) : [sheet.instrument]
    ).filter(Boolean))
  ));
  
  return (
    <div className="file-edit-box">
      {type === 'recording' && (
        <div className="autocomplete-wrapper">
          <input
            type="text"
            placeholder="Album"
            value={file.album || ''}
            onChange={e => handleChange('album', e.target.value)}
            onFocus={() => setFocusedField('album')}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
          />
          {focusedField === 'album' && albumOptions.length > 0 && (
            <div className="autocomplete-list">
              {albumOptions
                .filter(album =>
                  typeof album === 'string' &&
                  album.toLowerCase().includes((file.album || '').toLowerCase())
                )
                .map((album, idx) => (
                  <div
                    key={idx}
                    className="autocomplete-item"
                    onClick={() => handleChange('album', album)}
                  >
                    {album}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
      {type === 'sheet' && (
        <div className="autocomplete-wrapper">
          <input
            type="text"
            placeholder="Instrument"
            value={file.instrument || ''}
            onChange={e => handleChange('instrument', e.target.value)}
            onFocus={() => setFocusedField('instrument')}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
          />
          {focusedField === 'instrument' && instrumentOptions.length > 0 && (
            <div className="autocomplete-list">
              {instrumentOptions
                .filter(instr =>
                  typeof instr === 'string' &&
                  instr.toLowerCase().includes((file.instrument || '').toLowerCase())
                )
                .map((instr, idx) => (
                  <div
                    key={idx}
                    className="autocomplete-item"
                    onClick={() => handleChange('instrument', instr)}
                  >
                    {instr}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
      {type === 'lyrics' && (
        <input type="text"
          placeholder="Lyrics Name"
          value={file.name || ''}
          onChange={e => handleChange('name', e.target.value)}
        />
      )}
      {type === 'other' && (
        <input
          type="text"
          placeholder="Name"
          value={file.name || ''}
          onChange={e => handleChange('name', e.target.value)}
        />
      )}
      <input type="text" placeholder="Description" value={file.description || ''} onChange={e => handleChange('description', e.target.value)} />
      <input type="text" placeholder="Date" value={file.date || ''} onChange={e => handleChange('date', e.target.value)} />
      <div className="file-input-group">
        <input type="file" onChange={handleFileInput} />
        {file.file_path && (
          <div className="file-path-info">
            <span className="file-path-label">Current file:</span>
            <span className="file-path-value">{file.file_path}</span>
          </div>
        )}
      </div>

      {collections.length > 0 && (
        <select onChange={e => onAddToCollection(file, e.target.value)}>
          <option value="">Add to Collection</option>
          {collections.map((c, i) => (
            <option key={i} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="file-edit-actions">
        <button className="remove-button" onClick={onRemove}>Remove from Song</button>
      </div>
    </div>
  );
}

function CollectionEditor({ collection, type, onUpdate, onRemove, onRemoveFile, songs }) {
  const updatePart = (index, updatedFile) => {
    const updatedParts = [...collection.parts];
    updatedParts[index] = updatedFile;
    onUpdate({ ...collection, parts: updatedParts });
  };

  return (
    <div className="collection-box">
      <div className="collection-header-edit">
        <input
          type="text"
          value={collection.name}
          placeholder="Collection Name"
          onChange={e => onUpdate({ ...collection, name: e.target.value })}
        />
        <input
          type="text"
          value={collection.description}
          placeholder="Collection Description"
          onChange={e => onUpdate({ ...collection, description: e.target.value })}
        />
        <button className="remove-collection-button" onClick={onRemove}>Remove Collection</button>
      </div>

      {collection.parts.map((file, i) => (
        <div key={file.id || i}>
          <FileEditor
            file={file}
            onChange={updated => updatePart(i, updated)}
            onRemove={() => onRemoveFile(file, collection.id)}
            type={type}
            collections={[]}
            onAddToCollection={() => { }}
            songs={songs}
          />
          <button
            className="remove-from-collection"
            onClick={() => onRemoveFile(file, collection.id)}
          >
            Remove from Collection
          </button>
        </div>
      ))}
    </div>
  );
}

function FileList({ files, type, collections, onUpdateFile, onRemoveFile, onAddToCollection, songs }) {
  return files.map((file, index) => (
    <FileEditor
      key={file.id || index}
      file={file}
      type={type}
      collections={collections}
      onChange={updated => onUpdateFile(index, updated)}
      onRemove={() => onRemoveFile(file)}
      onAddToCollection={onAddToCollection}
      songs={songs}
    />
  ));
}

function SongAssetEditor({ title, files, onChange, type, songs }) {
  // Collections are items with parts array
  const collections = files.filter(f => Array.isArray(f.parts));
  // Ungrouped files are items without parts
  const ungrouped = files.filter(f => !Array.isArray(f.parts));
  
  // Ensure all files have IDs
  const ensureIds = (arr) => arr.map(f => f.id ? f : { ...f, id: getId() });
  
  // Update a collection
  const updateCollection = (index, updated) => {
    const updatedFiles = files.map(f => 
      f.id === updated.id ? updated : f
    );
    onChange(updatedFiles);
  };

  // Remove a collection and move its files to ungrouped
  const removeCollection = (collection) => {
    const collectionFiles = collection.parts.map(file => ({
      ...file,
      collection_id: null  // Clear collection association
    }));
    
    const filtered = files.filter(f => f.id !== collection.id);
    onChange([...filtered, ...collectionFiles]);
  };

  // Remove a file from a collection and move it to ungrouped
  const removeFromCollection = (file, collectionId) => {
    const updatedCollections = collections.map(c => 
      c.id == collectionId  // Loose equality
        ? { ...c, parts: c.parts.filter(f => f.id !== file.id) }
        : c
    );
    
    // Add file to ungrouped with collection_id cleared
    onChange([
      ...updatedCollections, 
      ...ungrouped, 
      { ...file, collection_id: null }  // Ensure collection_id is cleared
    ]);
  };

  // Remove a file completely (from ungrouped or collection)
  const removeFile = (file, collectionId = null) => {
    if (collectionId) {
      // Remove from specific collection
      const updatedCollections = collections.map(c => 
        c.id === collectionId
          ? {...c, parts: c.parts.filter(f => f.id !== file.id)}
          : c
      );
      onChange([...updatedCollections, ...ungrouped]);
    } else {
      // Remove from ungrouped
      const updatedUngrouped = ungrouped.filter(f => f.id !== file.id);
      onChange([...collections, ...updatedUngrouped]);
    }
  };

  // Add a file to a collection
  const addToCollection = (file, collectionId) => {
    const targetCollection = collections.find(c => c.id == collectionId); // Use loose equality
    
    if (targetCollection) {
      // Clear collection_id if moving from another collection
      const fileToAdd = file.id 
        ? {...file, collection_id: collectionId} 
        : {...file, id: getId(), collection_id: collectionId};
      
      const updatedCollection = {
        ...targetCollection,
        parts: [...targetCollection.parts, fileToAdd]
      };
      
      const updatedCollections = collections.map(c => 
        c.id == collectionId ? updatedCollection : c  // Loose equality
      );
      
      // Remove from ungrouped OR previous collection
      const filteredUngrouped = ungrouped.filter(f => f.id !== file.id);
      onChange([...updatedCollections, ...filteredUngrouped]);
    }
  };

  // Update an ungrouped file
  const updateUngroupedFile = (index, updated) => {
    const updatedUngrouped = [...ungrouped];
    updatedUngrouped[index] = updated;
    onChange([...collections, ...ensureIds(updatedUngrouped)]);
  };

  // Add a new collection
const addNewCollection = () => {
  // Map titles to asset types
  const titleToType = {
    '🎧 Recordings': 'Recordings',
    '🎼 Sheet Music': 'Sheet Music',
    '📝 Lyrics': 'Lyrics',
    '📁 Other Files': 'Other Files'
  };
  
  const newCollection = {
    id: `temp-${getId()}`,
    name: '',
    description: '',
    parts: [],
    asset_type: titleToType[title] || 'Other Files'
  };
  
  onChange([...files, newCollection]);
};

  // Add a new ungrouped file
  const addNewFile = () => {
    const newFile = {
      id: getId(),
      file_path: '',
      description: '',
      date: '',
      ...(type === 'recording' ? { album: '' } : {}),
      ...(type === 'sheet' ? { instrument: '' } : {}),
      ...(type === 'other' ? { name: '' } : {})
    };
    onChange([...files, newFile]);
  };

  return (
    <div className="file-section">
      <h4>{title}</h4>

      {collections.map((collection) => (
        <CollectionEditor
          key={collection.id}
          collection={collection}
          type={type}
          onUpdate={updated => updateCollection(null, updated)}
          onRemove={() => removeCollection(collection)}
          onRemoveFile={removeFromCollection}
          songs={songs}
        />
      ))}

      <FileList
        files={ensureIds(ungrouped)}
        type={type}
        collections={collections}
        onUpdateFile={updateUngroupedFile}
        onRemoveFile={removeFile}
        onAddToCollection={addToCollection}
        songs={songs}
      />

      <div className="section-actions">
        <button onClick={addNewCollection}>Create New Collection</button>
        <button onClick={addNewFile}>Add New File</button>
      </div>
    </div>
  );
}

export default SongAssetEditor;