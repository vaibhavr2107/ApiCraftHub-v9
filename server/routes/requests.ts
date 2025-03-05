import { Request, RequestSchema } from '@shared/schema';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import fsSync from 'fs'; // Import fsSync for synchronous operations

// Add type for history files sorting
interface HistoryFile {
  filename: string;
  timestamp: number;
}

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
    let existingRequest = JSON.parse(content);

    // Handle history requests limit
    if (updates.historyRequests && updates.historyRequests.length > 5) {
      updates.historyRequests = updates.historyRequests
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    }


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

router.post('/api/history', (req, res) => {
  try {
    const apiFolder = path.join(process.cwd(), 'client', 'api');
    if (!fsSync.existsSync(apiFolder)) {
      fsSync.mkdirSync(apiFolder, { recursive: true });
    }

    // Get list of existing history files
    const historyFiles: HistoryFile[] = fsSync.readdirSync(apiFolder)
      .filter(file => file.includes('history-') && file.endsWith('.json'))
      .map(filename => {
        const matches = filename.match(/\d+/g);
        const timestamp = matches ? parseInt(matches[matches.length - 1]) : 0;
        return { filename, timestamp };
      })
      .sort((a: HistoryFile, b: HistoryFile) => b.timestamp - a.timestamp);

    // Save new history file
    const request = req.body;
    const timestamp = new Date().getTime();
    const fileName = `${request.routeId}-${timestamp}.json`;

    fsSync.writeFileSync(
      path.join(apiFolder, fileName),
      JSON.stringify(request, null, 2)
    );

    // Remove oldest files if we exceed max (after adding new one)
    if (historyFiles.length >= 9) { // 9 + the one we just added = 10 total
      console.log(`Removing old history files: total count ${historyFiles.length + 1}`);
      historyFiles.slice(9).forEach(file => {
        console.log(`Removing old history file: ${file.filename}`);
        fsSync.unlinkSync(path.join(apiFolder, file.filename));
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving history request:', error);
    res.status(500).json({ error: 'Failed to save history request' });
  }
});

// Create a new request file
router.post('/requests', async (req, res) => {
  try {
    await ensureApiFolder();
    const requestData = req.body;
    
    // Generate IDs if not provided
    const timestamp = new Date().getTime();
    if (!requestData.requestId) {
      requestData.requestId = `${requestData.method.toLowerCase()}-${timestamp}`;
    }
    if (!requestData.routeId) {
      requestData.routeId = requestData.requestId;
    }
    if (!requestData.historyId) {
      requestData.historyId = `history-${requestData.requestId}`;
    }
    
    // Set created/updated timestamps
    const now = new Date().toISOString();
    requestData.createdAt = now;
    requestData.updatedAt = now;
    
    // Validate request with our schema
    const validatedRequest = RequestSchema.parse(requestData);
    
    // Save to file
    const filename = `${validatedRequest.routeId}.json`;
    const filePath = path.join(API_FOLDER, filename);
    
    await fs.writeFile(filePath, JSON.stringify(validatedRequest, null, 2));
    
    res.status(201).json({
      message: 'Request created successfully',
      request: validatedRequest,
      filename
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      error: 'Failed to create request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a request file
router.delete('/requests/:routeId', async (req, res) => {
  try {
    await ensureApiFolder();
    const { routeId } = req.params;
    
    const files = await fs.readdir(API_FOLDER);
    let requestFile = files.find(file => file === `${routeId}.json`);
    
    if (!requestFile) {
      requestFile = files.find(file => file.includes(routeId) && file.endsWith('.json'));
    }
    
    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const filePath = path.join(API_FOLDER, requestFile);
    await fs.unlink(filePath);
    
    res.json({
      message: 'Request deleted successfully',
      deletedFile: requestFile
    });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({
      error: 'Failed to delete request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;