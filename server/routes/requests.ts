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

    // Add missing fields if needed
    if (!request.routeId) {
      request.routeId = request.requestId || path.basename(filePath, '.json');
    }

    // Validate against schema
    return RequestSchema.parse(request);
  } catch (error) {
    console.error(`Error loading request file ${filePath}:`, error);
    return null;
  }
}

// GET all requests
router.get('/requests', async (req, res) => {
  try {
    await ensureApiFolder();
    const files = await fs.readdir(API_FOLDER);
    console.log('Found files:', files);

    const requests: Request[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(API_FOLDER, file);
      const request = await loadRequestFile(filePath);
      if (request) {
        requests.push(request);
      }
    }

    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET single request
router.get('/requests/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    await ensureApiFolder();

    const files = await fs.readdir(API_FOLDER);
    let request: Request | null = null;

    // Try each file until we find a matching request
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(API_FOLDER, file);
      const loadedRequest = await loadRequestFile(filePath);

      if (loadedRequest?.routeId === routeId || loadedRequest?.requestId === routeId) {
        request = loadedRequest;
        break;
      }
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error loading request:', error);
    res.status(500).json({ error: 'Failed to load request' });
  }
});

// Save request
router.post('/requests', async (req, res) => {
  try {
    const request = RequestSchema.parse(req.body);
    await ensureApiFolder();

    const fileName = `${request.routeId || request.requestId}.json`;
    const filePath = path.join(API_FOLDER, fileName);

    await fs.writeFile(filePath, JSON.stringify(request, null, 2));
    res.json({ message: 'Request saved successfully' });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

export default router;