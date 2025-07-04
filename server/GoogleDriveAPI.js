// GoogleDriveAPI.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');
const FOLDER_ID = '1eDjqD-G4JyF53Bk1hiTbW_FLUzJsIx89';

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

async function getDriveClient() {
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

async function getOrCreateFolder(drive, name, parentId) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  let res = await drive.files.list({
    q: query,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    const fileMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    res = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    return res.data.id;
  }
}

// Keep the '/songs' GET and POST routes as they are
app.post('/songs', async (req, res) => {
  try {
    const drive = await getDriveClient();
    const filePath = 'songs.json';
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));

    const list = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='songs.json' and trashed=false`,
      fields: 'files(id, name)',
    });

    const fileMetadata = { name: 'songs.json', parents: [FOLDER_ID] };
    const media = { mimeType: 'application/json', body: fs.createReadStream(filePath) };

    let fileId;
    if (list.data.files.length > 0) {
      fileId = list.data.files[0].id;
      await drive.files.update({ fileId, media });
    } else {
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
      fileId = response.data.id;
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'songs.json uploaded/updated', fileId });
  } catch (error) {
    console.error('Error uploading songs.json:', error);
    res.status(500).json({ error: 'Failed to upload songs.json', details: error.message });
  }
});

app.get('/songs', async (req, res) => {
  try {
    const drive = await getDriveClient();
    const list = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='songs.json' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (list.data.files.length === 0) {
      return res.status(404).json({ error: 'songs.json not found' });
    }

    const fileId = list.data.files[0].id;
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    const chunks = [];
    response.data.on('data', chunk => chunks.push(chunk));
    response.data.on('end', () => {
      const json = Buffer.concat(chunks).toString();
      try {
        const parsed = JSON.parse(json);
        res.json(parsed);
      } catch (err) {
        console.error('Invalid JSON in songs.json:', err);
        res.status(500).json({ error: 'Invalid JSON in songs.json' });
      }
    });
  } catch (error) {
    console.error('Error fetching songs.json:', error);
    res.status(500).json({ error: 'Failed to fetch songs.json', details: error.message });
  }
});

app.post('/upload-file', upload.single('file'), async (req, res) => {
  console.log('\n--- New File Upload Request ---');
  console.log('Request Body Received:', req.body);

  try {
    const { songName, assetType, collectionName, fileName } = req.body;
    if (!songName || !assetType || !fileName) {
        return res.status(400).json({ error: 'Missing required fields: songName, assetType, fileName' });
    }

    const drive = await getDriveClient();
    console.log(`Step 1: Ensuring song folder "${songName}" exists.`);
    const songFolderId = await getOrCreateFolder(drive, songName, FOLDER_ID);
    console.log(`   > Song folder ID: ${songFolderId}`);

    console.log(`Step 2: Ensuring asset folder "${assetType}" exists inside song folder.`);
    let parentFolderId = await getOrCreateFolder(drive, assetType, songFolderId);
    console.log(`   > Asset folder ID: ${parentFolderId}`);

    if (collectionName && collectionName.trim() !== '') {
        const trimmedCollectionName = collectionName.trim();
        console.log(`Step 3: Ensuring collection folder "${trimmedCollectionName}" exists inside asset folder.`);
        parentFolderId = await getOrCreateFolder(drive, trimmedCollectionName, parentFolderId);
        console.log(`   > Collection folder ID is now: ${parentFolderId}`);
    } else {
        console.log(`Step 3: Skipped collection folder creation because collectionName was "${collectionName}".`);
    }

    console.log(`Step 4: Checking for existing file "${fileName}" in parent folder ID ${parentFolderId}.`);
    const query = `name='${fileName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`;
    const listRes = await drive.files.list({ q: query, fields: 'files(id)', spaces: 'drive' });

    const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };
    let fileId;
    let message;

    if (listRes.data.files.length > 0) {
      fileId = listRes.data.files[0].id;
      console.log(`   > Found existing file with ID ${fileId}. Updating it.`);
      await drive.files.update({ fileId, media });
      message = 'File updated successfully';
    } else {
      console.log(`   > No existing file found. Creating a new one.`);
      const fileMetadata = { name: fileName, parents: [parentFolderId] };
      const createRes = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
      fileId = createRes.data.id;
      message = 'File created successfully';
      console.log(`   > New file created with ID ${fileId}.`);
    }

    fs.unlinkSync(req.file.path);
    res.json({ message, fileId });

  } catch (error) {
    console.error('File upload failed:', error);
    if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

// Keep the batch-delete and batch-rename endpoints as they are
app.post('/batch-delete-files', async (req, res) => {
  const { fileIds } = req.body;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(200).json({ message: 'No files to delete.' });
  }

  try {
    const drive = await getDriveClient();
    const deletePromises = fileIds.map(fileId =>
      drive.files.delete({ fileId }).catch(err => {
        console.error(`Failed to delete file ${fileId}: ${err.message}`);
      })
    );
    await Promise.all(deletePromises);
    res.json({ message: 'Files deleted successfully.' });
  } catch (error) {
    console.error('Error during batch delete:', error);
    res.status(500).json({ error: 'Failed to delete files', details: error.message });
  }
});

app.post('/batch-rename-files', async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(200).json({ message: 'No files to rename.' });
    }

    try {
        const drive = await getDriveClient();
        const renamePromises = files.map(file =>
            drive.files.update({
                fileId: file.fileId,
                resource: { name: file.newFileName },
            }).catch(err => {
                console.error(`Failed to rename file ${file.fileId}: ${err.message}`);
            })
        );
        await Promise.all(renamePromises);
        res.json({ message: 'Files renamed successfully.' });
    } catch (error) {
        console.error('Error during batch rename:', error);
        res.status(500).json({ error: 'Failed to rename files', details: error.message });
    }
});

// Keep the '/file/:id' GET route and app.listen call as they are
app.get('/file/:id', async (req, res) => {
  const drive = await getDriveClient();
  const fileId = req.params.id;

  try {
    const metadata = await drive.files.get({ fileId, fields: 'name, mimeType' });
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    res.setHeader('Content-Disposition', `attachment; filename="${metadata.data.name}"`);
    res.setHeader('Content-Type', metadata.data.mimeType);
    response.data.pipe(res);
  } catch (error) {
    console.error(`Error fetching file ${fileId}:`, error);
    res.status(404).send('File not found');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});