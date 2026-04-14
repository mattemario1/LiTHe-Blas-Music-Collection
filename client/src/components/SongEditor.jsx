import React, { useState } from 'react';
import './SongEditor.css';
import SongFieldsEditor from './SongFieldsEditor';
import SongAssetEditor from './SongAssetEditor';
import { uploadNewFiles } from './uploadUtils';

function SongEditor({ song, onSave, onCancel, songs }) {
  const [editedSong, setEditedSong] = useState({ ...song });
  const [progressMessage, setProgressMessage] = useState('');

  const handleChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setProgressMessage('Uploading files...');

    try {
      // Step 1: Upload any new files (ones with localFile set)
      // Each array is processed independently, collections and ungrouped alike
      const recordings = await uploadNewFiles(
        editedSong.recordings || [],
        'recordings',
        editedSong.id,
        editedSong.name,
        setProgressMessage
      );

      const sheetMusic = await uploadNewFiles(
        editedSong.sheetMusic || [],
        'sheetMusic',
        editedSong.id,
        editedSong.name,
        setProgressMessage
      );

      const lyrics = await uploadNewFiles(
        editedSong.lyrics || [],
        'lyrics',
        editedSong.id,
        editedSong.name,
        setProgressMessage
      );

      const otherFiles = await uploadNewFiles(
        editedSong.otherFiles || [],
        'otherFiles',
        editedSong.id,
        editedSong.name,
        setProgressMessage
      );

      // Step 2: Send the complete song to the server
      // The server handles renaming existing files and replacing all DB rows
      setProgressMessage('Saving...');

      const response = await fetch(`/api/songs/${editedSong.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedSong.name || '',
          description: editedSong.description || '',
          type: editedSong.type || '',
          status: editedSong.status || '',
          recordings,
          sheetMusic,
          lyrics,
          otherFiles
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Save failed: ${errText}`);
      }

      const savedSong = await response.json();
      setProgressMessage('');
      onSave(savedSong);

    } catch (err) {
      console.error('Save error:', err);
      setProgressMessage(`Error: ${err.message}`);
      setTimeout(() => setProgressMessage(''), 4000);
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
