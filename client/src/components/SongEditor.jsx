// SongEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';

// Helper to construct the standard filename
const constructFileName = (fileObj, assetType, songName) => {
  let fileNameDetail = '';
  switch(assetType) {
    case 'Recordings':
      fileNameDetail = fileObj.album || fileObj.name || 'Recording';
      break;
    case 'Sheet Music':
      fileNameDetail = fileObj.instrument || fileObj.name || 'Sheet';
      break;
    case 'Lyrics':
      fileNameDetail = fileObj.name || 'Lyrics';
      break;
    default:
      fileNameDetail = fileObj.name || 'File';
  }
  return `${songName || 'Untitled Song'} - ${fileNameDetail}`;
};

// Helper to get a flat list of all file objects from a song
const getAllFiles = (songData) => {
  const allFiles = [];
  const assetTypes = { recordings: 'Recordings', sheetMusic: 'Sheet Music', lyrics: 'Lyrics' };
  Object.keys(assetTypes).forEach(key => {
    (songData[key] || []).forEach(item => {
      if (Array.isArray(item.parts)) {
        // CORRECTED: Use `item.collection` instead of `item.name`
        item.parts.forEach(part => allFiles.push({ ...part, assetType: assetTypes[key], collectionName: item.collection }));
      } else {
        allFiles.push({ ...item, assetType: assetTypes[key] });
      }
    });
  });
  return allFiles;
};

function SongEditor({ song, onSave, onCancel }) {
  const [editedSong, setEditedSong] = useState({ ...song });
  const originalFileIds = useRef(new Set());
  const originalFileNames = useRef(new Map());

  useEffect(() => {
    const allInitialFiles = getAllFiles(song);
    const initialIdSet = new Set();
    const initialNameMap = new Map();

    allInitialFiles.forEach(file => {
      if (file.fileId) {
        initialIdSet.add(file.fileId);
        const originalName = constructFileName(file, file.assetType, song.name);
        initialNameMap.set(file.fileId, originalName);
      }
    });
    originalFileIds.current = initialIdSet;
    originalFileNames.current = initialNameMap;
  }, [song]);

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  const uploadFileIfNeeded = async (fileObj, assetType, collectionName) => {
    if (!fileObj.localFile || typeof fileObj.localFile !== 'object') return fileObj;

    const formData = new FormData();
    formData.append('file', fileObj.localFile);
    formData.append('songName', editedSong.name || 'Untitled Song');
    formData.append('assetType', assetType);
    
    if (typeof collectionName === 'string' && collectionName.trim() !== '') {
      formData.append('collectionName', collectionName.trim());
    }
    
    const finalFileName = constructFileName({ ...fileObj, name: fileObj.localFile.name }, assetType, editedSong.name);
    formData.append('fileName', finalFileName);

    try {
      const response = await fetch('http://localhost:5000/upload-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const driveUrl = `https://drive.google.com/uc?export=download&id=${data.fileId}`;
      return { ...fileObj, file: driveUrl, fileId: data.fileId, localFile: undefined };
    } catch (error) {
      console.error("Upload failed:", error);
      return fileObj;
    }
  };

  const uploadFilesInArray = async (arr, assetType) => {
    const result = [];
    for (const item of arr) {
      if (Array.isArray(item.parts)) {
        // CORRECTED: The property for the collection's name is `collection`, not `name`.
        const collectionName = item.collection;
        
        const updatedParts = await Promise.all(
          item.parts.map(part => uploadFileIfNeeded(part, assetType, collectionName))
        );
        result.push({ ...item, parts: updatedParts });
      } else {
        result.push(await uploadFileIfNeeded(item, assetType, null));
      }
    }
    return result;
  };

  const handleSave = async () => {
    const updatedRecordings = await uploadFilesInArray(editedSong.recordings || [], 'Recordings');
    const updatedSheetMusic = await uploadFilesInArray(editedSong.sheetMusic || [], 'Sheet Music');
    const updatedLyrics = await uploadFilesInArray(editedSong.lyrics || [], 'Lyrics');
    
    const finalSongState = { ...editedSong, recordings: updatedRecordings, sheetMusic: updatedSheetMusic, lyrics: updatedLyrics };

    const newFileIds = new Set(getAllFiles(finalSongState).map(f => f.fileId).filter(Boolean));
    const idsToDelete = [];
    originalFileIds.current.forEach(id => {
      if (!newFileIds.has(id)) {
        idsToDelete.push(id);
      }
    });

    if (idsToDelete.length > 0) {
      fetch('http://localhost:5000/batch-delete-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: idsToDelete }),
      }).catch(err => console.error('Failed to send delete request:', err));
    }

    const filesToRename = [];
    getAllFiles(finalSongState).forEach(file => {
      if (file.fileId && originalFileNames.current.has(file.fileId)) {
        const originalName = originalFileNames.current.get(file.fileId);
        const newName = constructFileName(file, file.assetType, finalSongState.name);
        if (originalName !== newName) {
          filesToRename.push({ fileId: file.fileId, newFileName: newName });
        }
      }
    });

    if (filesToRename.length > 0) {
        fetch('http://localhost:5000/batch-rename-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filesToRename }),
        }).catch(err => console.error('Failed to send rename request:', err));
    }

    onSave(finalSongState);
  };

  return (
    <div className="song-editor">
      <h2>Edit Song</h2>
      <SongFieldsEditor song={editedSong} onChange={handleChange} />
      <SongAssetEditor title="🎧 Recordings" files={editedSong.recordings || []} onChange={(files) => handleChange('recordings', files)} type="recording" />
      <SongAssetEditor title="🎼 Sheet Music" files={editedSong.sheetMusic || []} onChange={(files) => handleChange('sheetMusic', files)} type="sheet" />
      <SongAssetEditor title="📝 Lyrics" files={editedSong.lyrics || []} onChange={(files) => handleChange('lyrics', files)} type="lyrics" />
      <div className="editor-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default SongEditor;