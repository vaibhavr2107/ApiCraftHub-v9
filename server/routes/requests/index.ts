
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request } from '@shared/schema';

// Ensure __filename and __dirname are properly defined for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Directory where collections are stored
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Ensure the collections directory exists
if (!fs.existsSync(COLLECTIONS_DIR)) {
  fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
}

// Helper function to get all requests from all collections
function getAllRequests() {
  const requests = [];
  const files = fs.readdirSync(COLLECTIONS_DIR);

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8');
        const collection = JSON.parse(content);
        if (Array.isArray(collection.requests)) {
          requests.push(...collection.requests);
        }
      } catch (error) {
        console.error(`Error parsing collection file ${file}:`, error);
      }
    }
  }

  return requests;
}

// Get all requests
router.get('/', (req, res) => {
  try {
    const requests = getAllRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error getting requests:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// Get a specific request
router.get('/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    const requests = getAllRequests();
    const request = requests.find(r => r.requestId === requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error getting request:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

// Open a request (get by routeId)
router.get('/open/:routeId', (req, res) => {
  try {
    const { routeId } = req.params;
    const requests = getAllRequests();
    const request = requests.find(r => r.routeId === routeId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error getting request by routeId:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

// Create a new request
router.post('/', (req, res) => {
  try {
    // Basic validation
    const requestSchema = z.object({
      name: z.string(),
      method: z.string(),
      baseUrl: z.string(),
      collectionId: z.string()
    });

    // Validate required fields
    const validatedFields = requestSchema.parse(req.body);
    
    // Generate IDs if not provided
    const timestamp = new Date().getTime();
    const { name, method, baseUrl, collectionId } = validatedFields;
    
    const requestId = req.body.requestId || `${method.toLowerCase()}-${baseUrl.replace(/[^\w-]/g, '-')}-${timestamp}`;
    const routeId = req.body.routeId || requestId;
    const historyId = req.body.historyId || `history-${requestId}`;

    // Create request object with defaults
    const request: Request = {
      requestId,
      routeId,
      name,
      method,
      baseUrl,
      pathVariables: req.body.pathVariables || {},
      queryParams: req.body.queryParams || {},
      headers: req.body.headers || {},
      auth: req.body.auth || { type: "none" },
      requestBody: req.body.requestBody || {},
      responseFields: req.body.responseFields || {},
      exampleResponseBody: req.body.exampleResponseBody || {},
      historyId,
      historyRequests: [],
      devUrl: req.body.devUrl || '',
      qa01Url: req.body.qa01Url || '',
      qa02Url: req.body.qa02Url || '',
      qa03Url: req.body.qa03Url || '',
      perfUrl: req.body.perfUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      selectedEnvironment: req.body.selectedEnvironment || "qa01",
      tags: req.body.tags || [],
      collectionId,
      collectionName: req.body.collectionName || ''
    };

    // Find the collection file
    const collectionPath = path.join(COLLECTIONS_DIR, `${collectionId}.json`);
    let collection;

    if (fs.existsSync(collectionPath)) {
      // Collection exists, add the request
      const content = fs.readFileSync(collectionPath, 'utf8');
      collection = JSON.parse(content);
    } else {
      // Create a new collection
      collection = {
        id: collectionId,
        name: request.collectionName || 'New Collection',
        description: '',
        requests: []
      };
    }

    // Add the request to the collection
    collection.requests.push(request);

    // Save the collection
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));

    res.status(201).json({ success: true, request });
  } catch (error) {
    console.error('Error creating request:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Update a request
router.put('/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    const updatedRequest = req.body;
    
    // Find the collection containing this request
    const files = fs.readdirSync(COLLECTIONS_DIR);
    let found = false;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const collectionPath = path.join(COLLECTIONS_DIR, file);
      const content = fs.readFileSync(collectionPath, 'utf8');
      let collection = JSON.parse(content);
      
      if (!Array.isArray(collection.requests)) continue;
      
      const index = collection.requests.findIndex(r => r.requestId === requestId);
      if (index !== -1) {
        // Update the request
        const currentRequest = collection.requests[index];
        collection.requests[index] = {
          ...currentRequest,
          ...updatedRequest,
          requestId, // Ensure ID doesn't change
          updatedAt: new Date().toISOString()
        };
        
        // Save the updated collection
        fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
        found = true;
        res.json({ success: true, request: collection.requests[index] });
        break;
      }
    }

    if (!found) {
      res.status(404).json({ error: 'Request not found' });
    }
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// Delete a request
router.delete('/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Find the collection containing this request
    const files = fs.readdirSync(COLLECTIONS_DIR);
    let found = false;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const collectionPath = path.join(COLLECTIONS_DIR, file);
      const content = fs.readFileSync(collectionPath, 'utf8');
      let collection = JSON.parse(content);
      
      if (!Array.isArray(collection.requests)) continue;
      
      const index = collection.requests.findIndex(r => r.requestId === requestId);
      if (index !== -1) {
        // Remove the request
        collection.requests.splice(index, 1);
        
        // Save the updated collection
        fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
        found = true;
        res.json({ success: true });
        break;
      }
    }

    if (!found) {
      res.status(404).json({ error: 'Request not found' });
    }
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
