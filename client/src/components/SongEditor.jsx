import React, { useState, useEffect, useRef } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';
import {
  uploadFilesInArray, getAllFiles, constructFileName,
  deleteRemovedFiles, renameChangedFiles, uploadSongsJson
} from './uploadUtils';

function SongEditor({ song, onSave, onCancel, songs, setSongs }) {
  const [editedSong, setEditedSong] = useState({ ...song });
  const [progressMessage, setProgressMessage] = useState('');
  const originalFileIds = useRef(new Set());
  const originalFileNames = useRef(new Map());

  useEffect(() => {
    const initialFiles = getAllFiles(song);
    const idSet = new Set();
    const nameMap = new Map();
    initialFiles.forEach(f => {
      if (f.fileId) {
        idSet.add(f.fileId);
        nameMap.set(f.fileId, constructFileName(f, f.assetType, song.name));
      }
    });
    originalFileIds.current = idSet;
    originalFileNames.current = nameMap;
  }, [song]);

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setProgressMessage('Starting upload...');

    try {
      const updatedRecordings = await uploadFilesInArray(
        editedSong.recordings || [],
        'Recordings',
        editedSong.name,
        setProgressMessage
      );

      const updatedSheetMusic = await uploadFilesInArray(
        editedSong.sheetMusic || [],
        'Sheet Music',
        editedSong.name,
        setProgressMessage
      );

      const updatedLyrics = await uploadFilesInArray(
        editedSong.lyrics || [],
        'Lyrics',
        editedSong.name,
        setProgressMessage
      );

      const finalSong = {
        ...editedSong,
        recordings: updatedRecordings,
        sheetMusic: updatedSheetMusic,
        lyrics: updatedLyrics,
      };

      const newFileIds = new Set(getAllFiles(finalSong).map(f => f.fileId).filter(Boolean));
      const allNewFiles = getAllFiles(finalSong);

      await deleteRemovedFiles(originalFileIds.current, newFileIds);
      await renameChangedFiles(originalFileNames.current, finalSong, allNewFiles, setProgressMessage);

      const updatedSongs = songs.map(s => s.id === finalSong.id ? finalSong : s);
      setSongs(updatedSongs);

      await uploadSongsJson(updatedSongs, setProgressMessage);

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
      <div className="editor-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default SongEditor;