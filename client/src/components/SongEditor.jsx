import React, { useState, useEffect, useRef } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';
import {
  uploadFilesInArray, 
  getAllFiles,
  deleteRemovedFiles,
  updateFileMetadata,
  preserveCollectionInfo
} from './uploadUtils';

const updateFileInSong = (song, updatedFile) => {
  const assetTypes = {
    'Recordings': 'recordings',
    'Sheet Music': 'sheetMusic',
    'Lyrics': 'lyrics',
    'Other Files': 'otherFiles'
  };
  
  const assetType = assetTypes[updatedFile.asset_type];
  if (!assetType) return song;
  
  const newSong = { ...song };
  const assets = [...(newSong[assetType] || [])];
  
  // Update in collections
  for (let i = 0; i < assets.length; i++) {
    if (Array.isArray(assets[i].parts)) {
      // Collection item
      const parts = [...assets[i].parts];
      const partIndex = parts.findIndex(p => p.id === updatedFile.id);
      
      if (partIndex !== -1) {
        parts[partIndex] = { ...parts[partIndex], ...updatedFile };
        assets[i] = { ...assets[i], parts };
        newSong[assetType] = assets;
        return newSong;
      }
    } else if (assets[i].id === updatedFile.id) {
      // Single file
      assets[i] = { ...assets[i], ...updatedFile };
      newSong[assetType] = assets;
      return newSong;
    }
  }
  
  return newSong;
};

function SongEditor({ song, onSave, onCancel, songs, setSongs }) {
  const [editedSong, setEditedSong] = useState({ ...song });
  const [progressMessage, setProgressMessage] = useState('');
  const originalFileIds = useRef(new Set());

  useEffect(() => {
    const initialFiles = getAllFiles(song);
    const idSet = new Set();
    initialFiles.forEach(f => f.id && idSet.add(f.id));
    originalFileIds.current = idSet;
  }, [song]);

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setProgressMessage('Starting upload...');

    try {
      // Create a deep copy of the song with all files and collections
      let updatedSong = {
        ...editedSong,
        recordings: editedSong.recordings?.map(item =>
          item.parts ? { ...item, parts: item.parts.map(p => ({...p})) } : { ...item }
        ) || [],
        sheetMusic: editedSong.sheetMusic?.map(item =>
          item.parts ? { ...item, parts: item.parts.map(p => ({...p})) } : { ...item }
        ) || [],
        lyrics: editedSong.lyrics?.map(item =>
          item.parts ? { ...item, parts: item.parts.map(p => ({...p})) } : { ...item }
        ) || [],
        otherFiles: editedSong.otherFiles?.map(item =>
          item.parts ? { ...item, parts: item.parts.map(p => ({...p})) } : { ...item }
        ) || [],
      };

      // First save basic song info to get ID if new
      if (!updatedSong.id) {
        const response = await fetch('http://localhost:5000/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updatedSong.name || 'Untitled Song',
            description: updatedSong.description || '',
            type: updatedSong.type || '',
            status: updatedSong.status || 'Active'
          })
        });
        const data = await response.json();
        updatedSong.id = data.id;
      }

      // Process collections (groups with parts)
      setProgressMessage('Processing collections...');
      const collections = [
        ...(updatedSong.recordings || []).filter(c => Array.isArray(c.parts)),
        ...(updatedSong.sheetMusic || []).filter(c => Array.isArray(c.parts)),
        ...(updatedSong.lyrics || []).filter(c => Array.isArray(c.parts)),
        ...(updatedSong.otherFiles || []).filter(c => Array.isArray(c.parts))
      ];

      // Map to track temporary IDs to server IDs
      const idMap = new Map();
      
      for (const collection of collections) {
        try {
          if (collection.id && typeof collection.id === 'number') {
            // Update existing collection
            const response = await fetch(`http://localhost:5000/api/collections/${collection.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: collection.name || '',
                description: collection.description || ''
              })
            });
            
            if (!response.ok) throw new Error('Failed to update collection');
          } else {
            // Create new collection
            const response = await fetch('http://localhost:5000/api/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                song_id: updatedSong.id,
                name: collection.name || 'New Collection',
                asset_type: collection.asset_type || 'Other Files',
                description: collection.description || ''
              })
            });
            
            if (!response.ok) throw new Error('Failed to create collection');
            
            const data = await response.json();
            if (collection.id) {
              idMap.set(collection.id, data.id);
            }
            collection.id = data.id;
          }
        } catch (err) {
          console.error(`Error processing collection ${collection.id || collection.name}:`, err);
          throw err;
        }
      }

      // Update collection IDs in the song structure
      const updateIds = (arr) => {
        return arr.map(item => {
          if (Array.isArray(item.parts)) {
            const newId = idMap.get(item.id) || item.id;
            return {
              ...item,
              id: newId,
              parts: item.parts.map(part => ({
                ...part,
                collection_id: newId
              }))
            };
          }
          return item;
        });
      };

      updatedSong.recordings = updateIds(updatedSong.recordings || []);
      updatedSong.sheetMusic = updateIds(updatedSong.sheetMusic || []);
      updatedSong.lyrics = updateIds(updatedSong.lyrics || []);
      updatedSong.otherFiles = updateIds(updatedSong.otherFiles || []);

      // Update existing files with changed metadata
      setProgressMessage('Updating file metadata...');
      const allOriginalFiles = getAllFiles(song);
      const allEditedFiles = getAllFiles(updatedSong);
      
      for (const editedFile of allEditedFiles) {
        if (typeof editedFile.id === 'number' && !editedFile.localFile) {
          const originalFile = allOriginalFiles.find(f => f.id === editedFile.id);
          if (originalFile && JSON.stringify(editedFile) !== JSON.stringify(originalFile)) {
            const updatedFile = await updateFileMetadata(
              editedFile,
              editedFile.assetType,
              updatedSong.name,
              updatedSong.id
            );
            updatedSong = updateFileInSong(updatedSong, updatedFile);
          }
        }
      }

      // Upload all files (new and updated)
      setProgressMessage('Uploading files...');
      const updatedRecordings = await uploadFilesInArray(
        updatedSong.recordings || [],
        'Recordings',
        updatedSong.name,
        updatedSong.id,
        setProgressMessage
      );

      const updatedSheetMusic = await uploadFilesInArray(
        updatedSong.sheetMusic || [],
        'Sheet Music',
        updatedSong.name,
        updatedSong.id,
        setProgressMessage
      );

      const updatedLyrics = await uploadFilesInArray(
        updatedSong.lyrics || [],
        'Lyrics',
        updatedSong.name,
        updatedSong.id,
        setProgressMessage
      );

      const updatedOtherFiles = await uploadFilesInArray(
        updatedSong.otherFiles || [],
        'Other Files',
        updatedSong.name,
        updatedSong.id,
        setProgressMessage
      );

      // Combine all updates
      const finalSong = {
        ...updatedSong,
        recordings: updatedRecordings,
        sheetMusic: updatedSheetMusic,
        lyrics: updatedLyrics,
        otherFiles: updatedOtherFiles,
      };

      // Preserve collection information
      const allCollections = [
        ...updatedRecordings.filter(c => Array.isArray(c.parts)),
        ...updatedSheetMusic.filter(c => Array.isArray(c.parts)),
        ...updatedLyrics.filter(c => Array.isArray(c.parts)),
        ...updatedOtherFiles.filter(c => Array.isArray(c.parts))
      ];
      
      const songWithCollections = preserveCollectionInfo(finalSong, allCollections);

      // Handle file deletions
      const newFileIds = new Set(
        getAllFiles(songWithCollections)
          .map(f => f.id)
          .filter(Boolean)
      );
      
      await deleteRemovedFiles(originalFileIds.current, newFileIds);

      // Update local state
      const updatedSongs = songs.map(s => s.id === songWithCollections.id ? songWithCollections : s);
      setSongs(updatedSongs);

      setProgressMessage('Finalizing changes...');
      onSave(songWithCollections);
    } catch (error) {
      console.error('Error during save:', error);
      setProgressMessage(`Error: ${error.message}`);
      setTimeout(() => setProgressMessage(''), 3000);
    }
  };

  return (
    <div className="song-editor">
      <h2>Edit Song</h2>
      {progressMessage && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="loading-spinner"></div>
            <div>{progressMessage}</div>
          </div>
        </div>
      )}
      
      <SongFieldsEditor song={editedSong} onChange={handleChange} />
      
      <SongAssetEditor
        title="🎧 Recordings"
        files={editedSong.recordings || []}
        onChange={(files) => handleChange('recordings', files)}
        type="recording"
        songs={songs}
      />
      
      <SongAssetEditor
        title="🎼 Sheet Music"
        files={editedSong.sheetMusic || []}
        onChange={(files) => handleChange('sheetMusic', files)}
        type="sheet"
        songs={songs}
      />
      
      <SongAssetEditor
        title="📝 Lyrics"
        files={editedSong.lyrics || []}
        onChange={(files) => handleChange('lyrics', files)}
        type="lyrics"
        songs={songs}
      />
      
      <SongAssetEditor
        title="📁 Other Files"
        files={editedSong.otherFiles || []}
        onChange={(files) => handleChange('otherFiles', files)}
        type="other"
        songs={songs}
      />
      
      <div className="editor-actions-sticky">
        <div className="editor-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default SongEditor;