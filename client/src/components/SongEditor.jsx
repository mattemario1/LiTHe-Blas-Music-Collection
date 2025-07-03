// SongEditor.jsx
import React, { useState } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';

function SongEditor({ song, onSave, onCancel }) {
  const [editedSong, setEditedSong] = useState({ ...song });

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  const uploadFileIfNeeded = async (fileObj) => {
    if (!fileObj.localFile || typeof fileObj.localFile !== 'object') return fileObj;

    const formData = new FormData();
    formData.append('file', fileObj.localFile);

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

  const uploadFilesInArray = async (arr) => {
    const result = [];
    for (const item of arr) {
      if (Array.isArray(item.parts)) {
        const updatedParts = await Promise.all(item.parts.map(uploadFileIfNeeded));
        result.push({ ...item, parts: updatedParts });
      } else {
        result.push(await uploadFileIfNeeded(item));
      }
    }
    return result;
  };

  const handleSave = async () => {
    const updatedRecordings = await uploadFilesInArray(editedSong.recordings || []);
    const updatedSheetMusic = await uploadFilesInArray(editedSong.sheetMusic || []);
    const updatedLyrics = await uploadFilesInArray(editedSong.lyrics || []);
    onSave({ ...editedSong, recordings: updatedRecordings, sheetMusic: updatedSheetMusic, lyrics: updatedLyrics });
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
