import React, { useState, useEffect, useRef } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';
import {
  uploadFilesInArray, 
  getAllFiles, // NOW PROPERLY IMPORTED
  deleteRemovedFiles
} from './uploadUtils';

function SongEditor({ song, onSave, onCancel, songs, setSongs }) {
  const [editedSong, setEditedSong] = useState({ ...song });
  const [progressMessage, setProgressMessage] = useState('');
  const originalFileIds = useRef(new Set());

  useEffect(() => {
    const initialFiles = getAllFiles(song);
    const idSet = new Set();
    initialFiles.forEach(f => f.fileId && idSet.add(f.fileId));
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

      // Upload all files
      const updatedRecordings = await uploadFilesInArray(
        editedSong.recordings || [],
        'Recordings',
        editedSong.name,
        editedSong.id,
        setProgressMessage
      );

      const updatedSheetMusic = await uploadFilesInArray(
        editedSong.sheetMusic || [],
        'Sheet Music',
        editedSong.name,
        editedSong.id,
        setProgressMessage
      );

      const updatedLyrics = await uploadFilesInArray(
        editedSong.lyrics || [],
        'Lyrics',
        editedSong.name,
        editedSong.id,
        setProgressMessage
      );

      const updatedOtherFiles = await uploadFilesInArray(
        editedSong.otherFiles || [],
        'Other Files',
        editedSong.name,
        editedSong.id,
        setProgressMessage
      );

      const finalSong = {
        ...editedSong,
        recordings: updatedRecordings,
        sheetMusic: updatedSheetMusic,
        lyrics: updatedLyrics,
        otherFiles: updatedOtherFiles,
      };

      // Handle file deletions
      const newFileIds = new Set(getAllFiles(finalSong).map(f => f.fileId).filter(Boolean));
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