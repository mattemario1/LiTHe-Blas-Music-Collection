// SongAssetEditor.jsx
import React from 'react';

const getId = () => Date.now().toString();

function FileEditor({ file, onChange, onRemove, type, collections, onAddToCollection }) {
  const handleChange = (field, value) => onChange({ ...file, [field]: value });

  const handleFileInput = (e) => {
    const uploaded = e.target.files[0];
    if (uploaded) handleChange('localFile', uploaded);
  };

  return (
    <div className="file-edit-box">
      {type === 'recording' && (
        <input type="text" placeholder="Album" value={file.album || ''} onChange={e => handleChange('album', e.target.value)} />
      )}
      {type === 'sheet' && (
        <input type="text" placeholder="Instrument" value={file.instrument || ''} onChange={e => handleChange('instrument', e.target.value)} />
      )}
      {type === 'lyrics' && (
        <input type="text" placeholder="Lyrics Name" value={file.name || ''} onChange={e => handleChange('name', e.target.value)} />
      )}
      <input type="text" placeholder="Description" value={file.description || ''} onChange={e => handleChange('description', e.target.value)} />
      <input type="text" placeholder="Date" value={file.date || ''} onChange={e => handleChange('date', e.target.value)} />
      <input type="text" placeholder="Tags (comma separated)" value={file.tags?.join(', ') || ''} onChange={e => handleChange('tags', e.target.value.split(',').map(t => t.trim()))} />
      <input type="file" onChange={handleFileInput} />

      {collections.length > 0 && (
        <select onChange={e => onAddToCollection(file, e.target.value)}>
          <option value="">Add to Collection</option>
          {collections.map((c, i) => (
            <option key={i} value={c.collection}>{c.collection}</option>
          ))}
        </select>
      )}

      <div className="file-edit-actions">
        <a href={file.file} target="_blank" rel="noopener noreferrer">View File</a>
        <button className="remove-button" onClick={onRemove}>Remove from Song</button>
      </div>
    </div>
  );
}

function CollectionEditor({ collection, type, onUpdate, onRemove, onRemoveFile, onRemoveFromCollection }) {
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
          value={collection.collection}
          placeholder="Collection Name"
          onChange={e => onUpdate({ ...collection, collection: e.target.value })}
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
        <div key={file.fileId || i}>
          <FileEditor
            file={file}
            onChange={updated => updatePart(i, updated)}
            onRemove={() => onRemoveFile(file, collection.collectionId)}
            type={type}
            collections={[]}
            onAddToCollection={() => {}}
          />
          <button
            className="remove-from-collection"
            onClick={() => onRemoveFromCollection(file, collection.collectionId)}
          >
            Remove from Collection
          </button>
        </div>
      ))}
    </div>
  );
}

function FileList({ files, type, collections, onUpdateFile, onRemoveFile, onAddToCollection }) {
  return files.map((file, index) => (
    <FileEditor
      key={file.fileId || index}
      file={file}
      type={type}
      collections={collections}
      onChange={updated => onUpdateFile(index, updated)}
      onRemove={() => onRemoveFile(file)}
      onAddToCollection={onAddToCollection}
    />
  ));
}

function SongAssetEditor({ title, files, onChange, type }) {
  const collections = files.filter(f => Array.isArray(f.parts));
  const ungrouped = files.filter(f => !Array.isArray(f.parts));

  const ensureFileIds = (arr) => arr.map(f => f.fileId ? f : { ...f, fileId: getId() });

  const updateCollection = (index, updated) => {
    const updatedFiles = files.map(f =>
      f.collectionId === updated.collectionId ? updated : f
    );
    onChange(updatedFiles);
  };

  const removeCollection = (collection) => {
    const filtered = files.filter(f => f.collectionId !== collection.collectionId);
    onChange(filtered);
  };

  const removeFromCollection = (file, collectionId) => {
    const updatedCollections = collections.map(c =>
      c.collectionId === collectionId
        ? { ...c, parts: c.parts.filter(f => f.fileId !== file.fileId) }
        : c
    );
    onChange([...updatedCollections, ...ungrouped, { ...file }]);
  };

  const removeFile = (file, collectionId = null) => {
    if (collectionId) {
      const updatedCollections = collections.map(c =>
        c.collectionId === collectionId
          ? { ...c, parts: c.parts.filter(f => f.fileId !== file.fileId) }
          : c
      );
      onChange([...updatedCollections, ...ungrouped]);
    } else {
      const updatedUngrouped = ungrouped.filter(f => f.fileId !== file.fileId);
      onChange([...collections, ...updatedUngrouped]);
    }
  };

  const addToCollection = (file, collectionName) => {
    const updatedCollections = collections.map(c =>
      c.collection === collectionName
        ? { ...c, parts: [...ensureFileIds(c.parts), file] }
        : c
    );
    const filteredUngrouped = ungrouped.filter(f => f.fileId !== file.fileId);
    onChange([...updatedCollections, ...filteredUngrouped]);
  };

  const updateUngroupedFile = (index, updated) => {
    const updatedUngrouped = [...ungrouped];
    updatedUngrouped[index] = updated;
    onChange([...collections, ...ensureFileIds(updatedUngrouped)]);
  };

  const addNewCollection = () => {
    const newCollection = {
      collectionId: getId(),
      collection: '',
      description: '',
      parts: [],
    };
    onChange([...files, newCollection]);
  };

  const addNewFile = () => {
    const newFile = {
      fileId: getId(),
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

      {collections.map((collection) => (
        <CollectionEditor
          key={collection.collectionId}
          collection={collection}
          type={type}
          onUpdate={(updated) => updateCollection(null, updated)}
          onRemove={() => removeCollection(collection)}
          onRemoveFile={removeFile}
          onRemoveFromCollection={removeFromCollection}
        />
      ))}

      <FileList
        files={ensureFileIds(ungrouped)}
        type={type}
        collections={collections}
        onUpdateFile={updateUngroupedFile}
        onRemoveFile={removeFile}
        onAddToCollection={addToCollection}
      />

      <div className="section-actions">
        <button onClick={addNewCollection}>Create New Collection</button>
        <button onClick={addNewFile}>Add New File</button>
      </div>
    </div>
  );
}

export default SongAssetEditor;
