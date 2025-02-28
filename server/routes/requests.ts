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

// GET single request file by routeId
router.get('/requests/open/:routeId', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');

    const { routeId } = req.params;
    await ensureApiFolder();

    // Look for the file with matching routeId
    const files = await fs.readdir(API_FOLDER);
    const requestFile = files.find(file => file.startsWith(`${routeId}.json`) || file === `${routeId}.json`);

    if (!requestFile) {
      console.error(`Request file not found for routeId: ${routeId}`);
      return res.status(404).json({ error: 'Request not found' });
    }

    const filePath = path.join(API_FOLDER, requestFile);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`File access error for ${filePath}:`, error);
      return res.status(404).json({ error: 'Request file not found' });
    }

    // Read and parse the file
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const request = JSON.parse(content);
      const validatedRequest = RequestSchema.parse(request);
      return res.json(validatedRequest);
    } catch (error) {
      console.error(`Error reading/parsing file ${filePath}:`, error);
      return res.status(500).json({ 
        error: 'Failed to read request file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error opening request:', error);
    return res.status(500).json({ 
      error: 'Failed to open request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT update existing request file
router.put('/requests/update/:routeId', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');

    const { routeId } = req.params;
    const updates = req.body;

    await ensureApiFolder();

    // Find existing file
    const files = await fs.readdir(API_FOLDER);
    const requestFile = files.find(file => file.startsWith(`${routeId}.json`));

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const filePath = path.join(API_FOLDER, requestFile);

    // Read existing request
    const content = await fs.readFile(filePath, 'utf-8');
    const existingRequest = JSON.parse(content);

    // Merge updates with existing request
    const updatedRequest = {
      ...existingRequest,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Validate updated request
    const validatedRequest = RequestSchema.parse(updatedRequest);

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(validatedRequest, null, 2));

    res.json({
      message: 'Request updated successfully',
      request: validatedRequest
    });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ 
      error: 'Failed to update request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;