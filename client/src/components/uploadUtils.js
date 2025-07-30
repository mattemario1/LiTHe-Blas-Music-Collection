// uploadUtils.js
export const getAudioDuration = (file) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(url);
    };
    
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    
    audio.src = url;
  });
};

const sanitizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/[/\\?%*:|"<>]/g, '_') // Replace illegal characters
    .normalize('NFC'); // Normalize characters
};

export const constructFileName = (fileObj, assetType, songName, originalFileName) => {
  // Add null checks for all parameters
  if (!originalFileName) originalFileName = '';
  if (!fileObj) fileObj = {};
  if (!songName) songName = 'Untitled Song';

  // Determine base name based on metadata
  let fileNameDetail = '';
  switch (assetType) {
    case 'Recordings':
      fileNameDetail = fileObj.album || fileObj.name || 'Recording';
      break;
    case 'Sheet Music':
      fileNameDetail = fileObj.instrument || fileObj.name || 'Sheet';
      break;
    case 'Lyrics':
      fileNameDetail = fileObj.name || 'Lyrics';
      break;
    case 'Other Files':
      fileNameDetail = fileObj.name || 'File';
      break;
    default:
      fileNameDetail = fileObj.name || 'File';
  }

  // Extract year from date if available
  let year = '';
  if (fileObj.date) {
    const yearMatch = fileObj.date.match(/\b\d{4}\b/);
    if (yearMatch) year = ` -- ${yearMatch[0]}`;
  }

  // Get file extension safely
  const ext = typeof originalFileName === 'string' && originalFileName.includes('.') 
    ? originalFileName.substring(originalFileName.lastIndexOf('.')) 
    : '';

  // Construct safe filename
  return `${sanitizeName(songName)} - ${sanitizeName(fileNameDetail)}${year}${ext}`;
};

export const getAllFiles = (songData) => {
  const allFiles = [];
  const assetTypes = {
    recordings: 'Recordings',
    sheetMusic: 'Sheet Music',
    lyrics: 'Lyrics',
    otherFiles: 'Other Files'
  };

  Object.keys(assetTypes).forEach(key => {
    (songData[key] || []).forEach(item => {
      if (Array.isArray(item.parts)) {
        // Collection with parts
        item.parts.forEach(part => {
          allFiles.push({ 
            ...part, 
            assetType: assetTypes[key],
            collection_id: item.id,
            collectionName: item.name
          });
        });
      } else {
        // Ungrouped file
        allFiles.push({ 
          ...item, 
          assetType: assetTypes[key],
          collection_id: null
        });
      }
    });
  });
  return allFiles;
};

  export const uploadFileIfNeeded = async (fileObj, assetType, songName, songId, collectionName, setProgress) => {
    if (!fileObj.localFile) {
      // If no file to upload, just return the existing file data
      return fileObj;
    }

    // Calculate duration for audio files - with proper null checks
    let duration = 0;
    if (assetType === 'Recordings' && 
        fileObj.localFile && 
        fileObj.localFile.type && 
        fileObj.localFile.type.startsWith('audio/')) {
      try {
        duration = await getAudioDuration(fileObj.localFile);
      } catch (error) {
        console.error('Error calculating duration:', error);
      }
    }

    const finalCollectionName = fileObj.collectionName || collectionName || '';

    const newFileName = constructFileName(
      fileObj,
      assetType,
      songName,
      fileObj.localFile.name
    );

    const formData = new FormData();
    if (fileObj.localFile instanceof File || fileObj.localFile instanceof Blob) {
      formData.append('file', fileObj.localFile);
    } else {
      throw new Error('Invalid file object');
    }
    formData.append('songId', songId);
    formData.append('assetType', assetType);
    formData.append('collectionName', finalCollectionName);
    formData.append('fileName', newFileName);
    formData.append('metadata', JSON.stringify({
      name: fileObj.name,
      description: fileObj.description,
      date: fileObj.date,
      album: fileObj.album,
      instrument: fileObj.instrument,
      duration: duration || fileObj.duration
    }));

    if (fileObj.collection_id) {
      formData.append('collectionId', fileObj.collection_id);
    }

    const fileLabel = fileObj.localFile?.name || 'Unnamed File';
    setProgress?.(`Uploading ${assetType}: ${fileLabel}`);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      
      return { 
        ...fileObj,
        id: data.fileId || fileObj.id,  // Use server-generated ID
        file_path: data.filePath,
        localFile: undefined,
        duration: duration > 0 ? duration : fileObj.duration,
        collection_id: fileObj.collection_id || null
      };
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

export const uploadFilesInArray = async (arr, assetType, songName, songId, setProgress) => {
  const result = [];
  
  for (const item of arr) {
    if (Array.isArray(item.parts)) {
      // Process collection
      const updatedParts = await Promise.all(
        item.parts.map(part => uploadFileIfNeeded(
          part, 
          assetType, 
          songName, 
          songId, 
          item.name, // Collection name
          setProgress
        ))
      );
      
      result.push({ 
        ...item, 
        parts: updatedParts,
        asset_type: assetType
      });
    } else {
      // Process ungrouped file
      const uploadedFile = await uploadFileIfNeeded(
        item, 
        assetType, 
        songName, 
        songId, 
        null, 
        setProgress
      );
      result.push(uploadedFile);
    }
  }
  
  return result;
};

export const deleteRemovedFiles = async (oldIds, newIds) => {
  const toDelete = [...oldIds].filter(id => !newIds.has(id));
  if (toDelete.length === 0) return;

  try {
    const response = await fetch('/api/files/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: toDelete })
    });

    if (!response.ok) {
      throw new Error('Batch delete failed');
    }
  } catch (err) {
    console.error('Error during batch delete:', err);
    throw err;
  }
};

export const updateFileMetadata = async (fileObj, assetType, songName, songId) => {
  try {
    const response = await fetch(`/api/files/${fileObj.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fileObj.name,
        description: fileObj.description,
        date: fileObj.date,
        album: fileObj.album,
        instrument: fileObj.instrument,
        duration: fileObj.duration,
        collection_id: fileObj.collection_id || null  // Ensure we send collection_id
      })
    });

    if (!response.ok) throw new Error('Failed to update file metadata');

    const updatedFile = await response.json();
    
    return {
      ...updatedFile,
      collection_id: fileObj.collection_id || null,
      collectionName: fileObj.collectionName || null
    };
  } catch (err) {
    console.error('Error updating file metadata:', err);
    throw err;
  }
};

// Helper function to preserve collection references when updating files
export const preserveCollectionInfo = (song, collections) => {
  const updatedSong = { ...song };
  
  const updateAssetArray = (assetArray) => {
    return assetArray.map(item => {
      if (Array.isArray(item.parts)) {
        const collection = collections.find(c => c.id === item.id);
        return {
          ...item,
          name: collection?.name || item.name,
          parts: item.parts.map(part => ({
            ...part,
            collectionName: collection?.name || part.collectionName
          }))
        };
      } else {
        if (item.collection_id) {
          const collection = collections.find(c => c.id === item.collection_id);
          return {
            ...item,
            collectionName: collection?.name || item.collectionName
          };
        }
        return item;
      }
    });
  };

  updatedSong.recordings = updateAssetArray(updatedSong.recordings || []);
  updatedSong.sheetMusic = updateAssetArray(updatedSong.sheetMusic || []);
  updatedSong.lyrics = updateAssetArray(updatedSong.lyrics || []);
  updatedSong.otherFiles = updateAssetArray(updatedSong.otherFiles || []);

  return updatedSong;
};

