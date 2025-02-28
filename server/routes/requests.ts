import { Request, RequestSchema } from '@shared/schema';
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

// Helper to load and parse a request file
async function loadRequestFile(filePath: string): Promise<Request | null> {
  try {
    console.log('Loading request file:', filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const request = JSON.parse(content);

    // If file exists but doesn't have collection info, extract from filename
    if (!request.collectionId || !request.collectionName) {
      const fileName = path.basename(filePath, '.json');
      const parts = fileName.split('-');

      // Assuming format: collection-name-request-name.json
      const collectionParts = parts.slice(0, -1); // All parts except last one for collection
      const collectionId = collectionParts.join('-');
      const collectionName = collectionParts.join(' ').replace(/\b\w/g, l => l.toUpperCase());

      request.collectionId = request.collectionId || collectionId;
      request.collectionName = request.collectionName || collectionName;
    }

    return RequestSchema.parse(request);
  } catch (error) {
    console.error(`Error loading request file ${filePath}:`, error);
    return null;
  }
}

// GET all requests from API folder
router.get('/requests', async (req, res) => {
  try {
    console.log('Starting /requests endpoint');
    await ensureApiFolder();

    const files = await fs.readdir(API_FOLDER);
    console.log('All files in API folder:', files);

    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log('JSON files found:', jsonFiles);

    const requests: Request[] = [];
    for (const file of jsonFiles) {
      const filePath = path.join(API_FOLDER, file);
      const request = await loadRequestFile(filePath);
      if (request) {
        requests.push(request);
      }
    }

    console.log('Total requests loaded:', requests.length);
    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET request file
router.get('/requests/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    console.log('Loading request by routeId:', routeId);

    // Read all files and find the one matching routeId
    const files = await fs.readdir(API_FOLDER);

    for (const file of files) {
      const filePath = path.join(API_FOLDER, file);
      const request = await loadRequestFile(filePath);

      if (request && request.routeId === routeId) {
        console.log('Found matching request:', request);
        return res.json(request);
      }
    }

    throw new Error('Request not found');
  } catch (error) {
    console.error('Error loading request:', error);
    res.status(404).json({ 
      error: 'Request not found',
      routeId: req.params.routeId 
    });
  }
});

// Save request file
router.post('/requests', async (req, res) => {
  try {
    console.log('Saving request:', req.body);
    await ensureApiFolder();

    const request: Request = RequestSchema.parse(req.body);
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

export default router;