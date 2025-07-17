import React, { useState, useEffect, useRef } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';
import {
  uploadFilesInArray, 
  getAllFiles, // NOW PROPERLY IMPORTED
  deleteRemovedFiles,
  updateFileMetadata
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
      // First save basic song info to get ID if new
      if (!editedSong.id) {
        const response = await fetch('http://localhost:5000/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editedSong.name,
            description: editedSong.description,
            type: editedSong.type,
            status: editedSong.status
          })
        });
        const data = await response.json();
        editedSong.id = data.id;
      }

      // Update existing files with changed metadata
      setProgressMessage('Updating file metadata...');
      const allOriginalFiles = getAllFiles(song);
      const allEditedFiles = getAllFiles(editedSong);
      
      // Create a copy of editedSong to update
      let updatedSong = { ...editedSong };
      
      for (const editedFile of allEditedFiles) {
        if (!editedFile.localFile && editedFile.id) {
          const originalFile = allOriginalFiles.find(f => f.id === editedFile.id);
          if (originalFile && JSON.stringify(editedFile) !== JSON.stringify(originalFile)) {
            // Update metadata and get new file data
            const updatedFile = await updateFileMetadata(
              editedFile,
              editedFile.assetType,
              editedSong.name,
              editedSong.id
            );
            
            // Update the song with the new file data
            updatedSong = updateFileInSong(updatedSong, updatedFile);
          }
        }
      }
      
      // Use the updatedSong for subsequent operations
      setEditedSong(updatedSong);

      // Upload all files
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

      const finalSong = {
        ...updatedSong,
        recordings: updatedRecordings,
        sheetMusic: updatedSheetMusic,
        lyrics: updatedLyrics,
        otherFiles: updatedOtherFiles,
      };

      // Handle file deletions
      const newFileIds = new Set(
        getAllFiles(finalSong)
          .map(f => f.id)  // Use 'id' instead of 'fileId'
          .filter(Boolean)
      );
      await deleteRemovedFiles(originalFileIds.current, newFileIds);

      // Update local state
      const updatedSongs = songs.map(s => s.id === finalSong.id ? finalSong : s);
      setSongs(updatedSongs);

      setProgressMessage('Saving changes...');
      onSave(finalSong);
    } catch (error) {
      console.error('Error during save:', error);
      setProgressMessage('Error saving changes');
    } finally {
      setTimeout(() => setProgressMessage(''), 2000);
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