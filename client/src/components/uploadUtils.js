// uploadUtils.js

const getAudioDuration = (file) => {
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

export const constructFileName = (fileObj, assetType, songName) => {
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
  return `${songName || 'Untitled Song'} - ${fileNameDetail}`;
};

export const getAllFiles = (songData) => {
  const allFiles = [];
  const assetTypes = {
    recordings: 'Recordings',
    sheetMusic: 'Sheet Music',
    lyrics: 'Lyrics',
    otherFiles: 'Other Files' // Add new asset type
  };
  
  Object.keys(assetTypes).forEach(key => {
    (songData[key] || []).forEach(item => {
      if (Array.isArray(item.parts)) {
        item.parts.forEach(part => allFiles.push({ 
          ...part, 
          assetType: assetTypes[key], 
          collectionName: item.collection 
        }));
      } else {
        allFiles.push({ ...item, assetType: assetTypes[key] });
      }
    });
  });
  return allFiles;
};

export const uploadFileIfNeeded = async (fileObj, assetType, songName, collectionName, setProgress) => {
  if (!fileObj.localFile || typeof fileObj.localFile !== 'object') return fileObj;

  // Calculate duration for audio files
  let duration = 0;
  if (assetType === 'Recordings' && fileObj.localFile.type.startsWith('audio/')) {
    try {
      duration = await getAudioDuration(fileObj.localFile);
    } catch (error) {
      console.error('Error calculating duration:', error);
    }
  }

  const formData = new FormData();
  formData.append('file', fileObj.localFile);
  formData.append('songName', songName || 'Untitled Song');
  formData.append('assetType', assetType);
  
  // FIX: Handle file extension safely
  const originalName = fileObj.localFile.name || 'file';
  const extension = originalName.includes('.') 
    ? originalName.split('.').pop() 
    : '';
  const baseName = constructFileName(fileObj, assetType, songName);
  
  const fileName = extension 
    ? `${baseName}.${extension}`
    : baseName;
  
  formData.append('fileName', fileName);
  
  if (collectionName) formData.append('collectionName', collectionName);
  
  // Include duration in the file object
  if (duration > 0) {
    formData.append('duration', duration.toString());
  }

  const fileLabel = fileObj.localFile.name || 'Unnamed File';
  setProgress?.(`Uploading ${assetType}: ${fileLabel}`);

  const res = await fetch('http://localhost:5000/upload-file', { method: 'POST', body: formData });
  const data = await res.json();
  const driveUrl = `https://drive.google.com/uc?export=download&id=${data.fileId}`;
  
  return { 
    ...fileObj, 
    file: driveUrl, 
    fileId: data.fileId, 
    localFile: undefined,
    duration: duration > 0 ? duration : fileObj.duration // Preserve existing duration if any
  };
};

export const uploadFilesInArray = async (arr, assetType, songName, setProgress) => {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item.parts)) {
      const updatedParts = await Promise.all(
        item.parts.map(part => uploadFileIfNeeded(part, assetType, songName, item.collection, setProgress))
      );
      result.push({ ...item, parts: updatedParts });
    } else {
      result.push(await uploadFileIfNeeded(item, assetType, songName, null, setProgress));
    }
  }
  return result;
};

export const deleteRemovedFiles = async (oldIds, newIds) => {
  const toDelete = [...oldIds].filter(id => !newIds.has(id));
  if (toDelete.length > 0) {
    await fetch('http://localhost:5000/batch-delete-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: toDelete })
    });
  }
};

export const renameChangedFiles = async (fileMap, song, newFiles, setProgress) => {
  const renameList = [];
  for (const file of newFiles) {
    if (file.fileId && fileMap.has(file.fileId)) {
      const original = fileMap.get(file.fileId);
      const newName = constructFileName(file, file.assetType, song.name);
      if (original !== newName) {
        setProgress?.(`Renaming: ${newName}`);
        renameList.push({ fileId: file.fileId, newFileName: newName });
      }
    }
  }

  if (renameList.length > 0) {
    await fetch('http://localhost:5000/batch-rename-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: renameList })
    });
  }
};

export const uploadSongsJson = async (songs, setProgress) => {
  setProgress?.("Uploading updated song data...");

  try {
    const res = await fetch('http://localhost:5000/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(songs),
    });

    const text = await res.text();
    JSON.parse(text); // Validate response
  } catch (err) {
    console.error('Upload failed:', err);
    throw new Error("Failed to upload song data JSON.");
  }
};
