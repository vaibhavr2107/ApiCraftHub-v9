import { Request } from '@shared/schema';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const API_FOLDER = path.join(process.cwd(), 'client', 'api');

// Ensure API folder exists
async function ensureApiFolder() {
  try {
    await fs.access(API_FOLDER);
  } catch {
    await fs.mkdir(API_FOLDER, { recursive: true });
  }
}

// GET request file
router.get('/requests/:routeId', async (req, res) => {
  try {
    console.log('Loading request:', req.params.routeId);
    const { routeId } = req.params;
    const filePath = path.join(API_FOLDER, `${routeId}.json`);

    const data = await fs.readFile(filePath, 'utf-8');
    console.log('Found request file:', data);

    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (error) {
    console.error('Error loading request:', error);
    res.status(404).json({ error: 'Request not found' });
  }
});

// Save request file
router.post('/requests', async (req, res) => {
  try {
    console.log('Saving request:', req.body);
    await ensureApiFolder();

    const request: Request = req.body;
    if (!request.routeId) {
      throw new Error('Request must have a routeId');
    }

    const filePath = path.join(API_FOLDER, `${request.routeId}.json`);

    // Check if file exists to handle versioning
    let version = 1;
    try {
      const existingData = await fs.readFile(filePath, 'utf-8');
      const existingRequest = JSON.parse(existingData);
      version = (existingRequest.version || 0) + 1;
      request.version = version;
    } catch (e) {
      // File doesn't exist, use default version
      request.version = version;
    }

    await fs.writeFile(filePath, JSON.stringify(request, null, 2));
    console.log('Saved request file:', filePath);

    res.json({
      message: "Request saved successfully",
      fileName: `${request.routeId}.json`,
      version: request.version
    });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

// List all request files
router.get('/requests/files', async (req, res) => {
  try {
    await ensureApiFolder();
    const files = await fs.readdir(API_FOLDER);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log('Listed request files:', jsonFiles);
    res.json(jsonFiles);
  } catch (error) {
    console.error('Error listing request files:', error);
    res.status(500).json({ error: 'Failed to list request files' });
  }
});

export default router;