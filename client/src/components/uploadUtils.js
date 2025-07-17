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

const sanitizeName = (name) => {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_') // Replace illegal characters
    .normalize('NFC') // Normalize characters
};

export const constructFileName = (fileObj, assetType, songName, originalFileName) => {
  let fileNameDetail = '';
  switch (assetType) {
    case 'Recordings':
      fileNameDetail = sanitizeName(fileObj.album || fileObj.name || 'Recording');
      break;
    case 'Sheet Music':
      fileNameDetail = sanitizeName(fileObj.instrument || fileObj.name || 'Sheet');
      break;
    case 'Lyrics':
      fileNameDetail = sanitizeName(fileObj.name || 'Lyrics');
      break;
    case 'Other Files':
      fileNameDetail = sanitizeName(fileObj.name || 'File');
      break;
    default:
      fileNameDetail = sanitizeName(fileObj.name || 'File');
  }
  
  // Extract year from date if available (look for 4-digit year)
  let year = '';
  if (fileObj.date) {
    const yearMatch = fileObj.date.match(/\b\d{4}\b/);
    if (yearMatch) {
      year = ` -- ${yearMatch[0]}`;
    }
  }
  
  // Get file extension from original filename
  const ext = originalFileName.includes('.') 
    ? originalFileName.substring(originalFileName.lastIndexOf('.'))
    : '';
    
  return `${songName || 'Untitled Song'} - ${fileNameDetail}${year}${ext}`;
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

export const uploadFileIfNeeded = async (fileObj, assetType, songName, songId, collectionName, setProgress) => {
  if (!fileObj.localFile) return fileObj;

  // Calculate duration for audio files
  let duration = 0;
  if (assetType === 'Recordings' && fileObj.localFile.type.startsWith('audio/')) {
    try {
      duration = await getAudioDuration(fileObj.localFile);
    } catch (error) {
      console.error('Error calculating duration:', error);
    }
  }

  // Generate the new filename
  const newFileName = constructFileName(
    fileObj,
    assetType,
    songName,
    fileObj.localFile.name
  );

  const formData = new FormData();
  formData.append('file', fileObj.localFile);
  formData.append('songId', songId);
  formData.append('assetType', assetType);
  formData.append('collectionName', collectionName || '');
  formData.append('fileName', newFileName);  // Use the new filename here
  formData.append('metadata', JSON.stringify({
    name: fileObj.name,
    description: fileObj.description,
    date: fileObj.date,
    album: fileObj.album,
    instrument: fileObj.instrument,
    duration: duration || fileObj.duration
  }));

  if (fileObj.collectionId) {
    formData.append('collectionId', fileObj.collectionId);
  }

  const fileLabel = fileObj.localFile.name || 'Unnamed File';
  setProgress?.(`Uploading ${assetType}: ${fileLabel}`);

  const res = await fetch('http://localhost:5000/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  return { 
    ...fileObj, 
    file_path: data.filePath,
    localFile: undefined,
    duration: duration > 0 ? duration : fileObj.duration
  };
};

export const uploadFilesInArray = async (arr, assetType, songName, songId, setProgress) => {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item.parts)) {
      const updatedParts = await Promise.all(
        item.parts.map(part => uploadFileIfNeeded(
          part, 
          assetType, 
          songName, 
          songId, 
          item.collection, 
          setProgress
        ))
      );
      result.push({ ...item, parts: updatedParts });
    } else {
      result.push(await uploadFileIfNeeded(
        item, 
        assetType, 
        songName, 
        songId, 
        null, 
        setProgress
      ));
    }
  }
  return result;
};

export const deleteRemovedFiles = async (oldIds, newIds) => {
  const toDelete = [...oldIds].filter(id => !newIds.has(id));
  if (toDelete.length > 0) {
    await fetch('http://localhost:5000/api/files/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: toDelete })
    });
  }
};

export const updateFileMetadata = async (fileObj, assetType, songName, songId) => {
  const response = await fetch(`http://localhost:5000/api/files/${fileObj.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fileObj.name,
      description: fileObj.description,
      date: fileObj.date,
      album: fileObj.album,
      instrument: fileObj.instrument,
      duration: fileObj.duration
    })
  });
  
  if (!response.ok) throw new Error('Failed to update file metadata');
  return await response.json(); // Return the updated file object
};