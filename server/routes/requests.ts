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

    // Extract collection info from file name
    const fileName = path.basename(filePath, '.json');
    const parts = fileName.split('-');

    console.log('Parsed file name parts:', parts);

    // Assuming format: box-platform-api-action-v1.json
    const collectionId = parts[0] + '-' + parts[1] + '-api';
    const collectionName = (parts[0] + ' ' + parts[1] + ' API').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Merge with request data
    const requestWithCollection = {
      ...request,
      collectionId,
      collectionName
    };

    console.log('Processing request:', requestWithCollection);
    return RequestSchema.parse(requestWithCollection);
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
    console.log('Loading request:', req.params.routeId);
    const { routeId } = req.params;
    const filePath = path.join(API_FOLDER, `${routeId}.json`);

    const request = await loadRequestFile(filePath);
    if (!request) {
      throw new Error('Request not found');
    }

    res.json(request);
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