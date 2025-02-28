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

// GET all requests
router.get('/requests', async (req, res) => {
  try {
    await ensureApiFolder();
    const files = await fs.readdir(API_FOLDER);
    const requests: Request[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(API_FOLDER, file), 'utf-8');
        const request = JSON.parse(content);
        const validatedRequest = RequestSchema.parse(request);
        requests.push(validatedRequest);
      } catch (error) {
        console.error(`Error loading request file ${file}:`, error);
      }
    }

    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET request by routeId
router.get('/requests/open/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    await ensureApiFolder();

    // Look for exact match first
    const files = await fs.readdir(API_FOLDER);
    let requestFile = files.find(file => file === `${routeId}.json`);

    // If no exact match, try to find a file starting with routeId
    if (!requestFile) {
      requestFile = files.find(file => file.includes(routeId) && file.endsWith('.json'));
    }

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const filePath = path.join(API_FOLDER, requestFile);
    const content = await fs.readFile(filePath, 'utf-8');

    try {
      const request = JSON.parse(content);
      const validatedRequest = RequestSchema.parse({
        ...request,
        historyRequests: request.historyRequests || [],
        devUrl: request.devUrl || '',
        qa01Url: request.qa01Url || '',
        qa02Url: request.qa02Url || '',
        qa03Url: request.qa03Url || '',
        perfUrl: request.perfUrl || ''
      });

      return res.json(validatedRequest);
    } catch (error) {
      console.error(`Error parsing request file ${requestFile}:`, error);
      return res.status(500).json({ 
        error: 'Failed to parse request file',
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

// PUT update request
router.put('/requests/update/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const updates = req.body;

    await ensureApiFolder();

    // Find the request file
    const files = await fs.readdir(API_FOLDER);
    let requestFile = files.find(file => file === `${routeId}.json`);

    if (!requestFile) {
      requestFile = files.find(file => file.includes(routeId) && file.endsWith('.json'));
    }

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const filePath = path.join(API_FOLDER, requestFile);
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