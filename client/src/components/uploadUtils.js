// uploadUtils.js
// Much simpler than before - just handles uploading files to the server
// and calculating audio duration. Everything else happens in SongEditor.

/**
 * Get the duration of an audio file in seconds.
 * Returns 0 if it can't be determined.
 */
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

/**
 * Upload a single file to the server.
 * Returns the file_path string to store in state/database.
 *
 * @param {File} file - The local File object
 * @param {string} songId - The song this file belongs to
 * @param {string} songName - Used for filename construction on the server
 * @param {string} assetType - 'recordings' | 'sheetMusic' | 'lyrics' | 'otherFiles'
 * @param {object} metadata - name, album, instrument, date etc
 * @param {function} onProgress - optional callback with a status string
 */
export const uploadFile = async (file, songId, songName, assetType, metadata, onProgress) => {
  // Calculate duration for audio files
  let duration = 0;
  if (assetType === 'recordings' && file.type?.startsWith('audio/')) {
    try {
      duration = await getAudioDuration(file);
    } catch {
      duration = 0;
    }
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('songId', songId);
  formData.append('songName', songName);
  formData.append('assetType', assetType);
  formData.append('metadata', JSON.stringify({ ...metadata, duration }));

  onProgress?.(`Uploading: ${file.name}`);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }

  const data = await res.json();
  return { filePath: data.filePath, duration };
};

/**
 * Walk through all items in an asset array (collections and ungrouped files)
 * and upload any that have a localFile. Returns the array with localFiles
 * replaced by file_paths.
 *
 * @param {Array} items - The asset array (recordings, sheetMusic etc)
 * @param {string} assetType - 'recordings' | 'sheetMusic' | 'lyrics' | 'otherFiles'
 * @param {string} songId
 * @param {string} songName
 * @param {function} onProgress
 */
export const uploadNewFiles = async (items, assetType, songId, songName, onProgress) => {
  const result = [];

  for (const item of items) {
    if (Array.isArray(item.parts)) {
      // It's a collection - process each part, passing the collection name for filename construction
      const uploadedParts = [];
      for (const part of item.parts) {
        uploadedParts.push(
          await uploadSingleItem(part, assetType, songId, songName, onProgress, item.name)
        );
      }
      result.push({ ...item, parts: uploadedParts });
    } else {
      // It's an ungrouped file
      result.push(
        await uploadSingleItem(item, assetType, songId, songName, onProgress)
      );
    }
  }

  return result;
};

/**
 * Upload a single item if it has a localFile, otherwise return as-is.
 * collectionName is passed when the item belongs to a collection.
 */
const uploadSingleItem = async (item, assetType, songId, songName, onProgress, collectionName) => {
  if (!item.localFile) return item;

  const { filePath, duration } = await uploadFile(
    item.localFile,
    songId,
    songName,
    assetType,
    {
      name: item.name,
      album: item.album,
      instrument: item.instrument,
      date: item.date,
      description: item.description,
      collectionName: collectionName
    },
    onProgress
  );

  // Remove localFile, set the real path and duration
  const { localFile, ...rest } = item;
  return {
    ...rest,
    file_path: filePath,
    duration: duration > 0 ? duration : item.duration || 0
  };
};
