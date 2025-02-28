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

    // Ensure environment URLs exist
    request.devUrl = request.devUrl || '';
    request.qa01Url = request.qa01Url || '';
    request.qa02Url = request.qa02Url || '';
    request.qa03Url = request.qa03Url || '';
    request.perfUrl = request.perfUrl || '';

    // Ensure history exists
    request.historyRequests = request.historyRequests || [];

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

    // Set proper content type header
    res.setHeader('Content-Type', 'application/json');
    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET single request
router.get('/requests/:routeId', async (req, res, next) => {
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
      console.log('Checking request:', loadedRequest?.routeId, 'against:', routeId);

      if (loadedRequest?.routeId === routeId || loadedRequest?.requestId === routeId) {
        request = loadedRequest;
        break;
      }
    }

    if (!request) {
      // Set JSON content type even for error responses
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Request not found' });
    }

    // Set proper content type header
    res.setHeader('Content-Type', 'application/json');
    res.json(request);
  } catch (error) {
    // Ensure JSON response for errors
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to load request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save request
router.post('/requests', async (req, res) => {
  try {
    const request = RequestSchema.parse(req.body);
    await ensureApiFolder();

    // Generate routeId if not provided
    if (!request.routeId) {
      request.routeId = request.requestId;
    }

    // Implement versioning
    const baseFileName = request.routeId.replace(/-v\d+$/, ''); // Remove existing version
    const files = await fs.readdir(API_FOLDER);
    let version = 1;

    // Find existing versions
    const versionRegex = new RegExp(`^${baseFileName}-v(\\d+)\\.json$`);
    for (const file of files) {
      const match = file.match(versionRegex);
      if (match) {
        const fileVersion = parseInt(match[1]);
        version = Math.max(version, fileVersion + 1);
      }
    }

    // Update routeId with version
    request.routeId = `${baseFileName}-v${version}`;
    request.requestId = request.routeId;
    request.version = version;

    // Manage history - keep only last 5 entries
    if (request.historyRequests && request.historyRequests.length > 5) {
      request.historyRequests = request.historyRequests.slice(-5);
    }

    const filePath = path.join(API_FOLDER, `${request.routeId}.json`);
    await fs.writeFile(filePath, JSON.stringify(request, null, 2));

    // Set proper content type header
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
      message: 'Request saved successfully',
      request 
    });
  } catch (error) {
    // Ensure JSON response for errors
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to save request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;