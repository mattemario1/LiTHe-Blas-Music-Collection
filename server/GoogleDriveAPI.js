const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

// Upload a file (e.g., audio, sheet music)
// app.post('/upload-file', upload.single('file'), async (req, res) => {
//   const drive = await getDriveClient();
//   const fileMetadata = { name: req.file.originalname, parents: [FOLDER_ID] };
//   const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };

//   const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

//   fs.unlinkSync(req.file.path);
//   res.json({ message: 'File uploaded', fileId: response.data.id });
// });

// // Get a file by ID
// app.get('/file/:id', async (req, res) => {
//   const drive = await getDriveClient();
//   const fileId = req.params.id;

//   const metadata = await drive.files.get({ fileId, fields: 'name, mimeType' });
//   const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

//   res.setHeader('Content-Disposition', `attachment; filename="${metadata.data.name}"`);
//   res.setHeader('Content-Type', metadata.data.mimeType);
//   response.data.pipe(res);
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
