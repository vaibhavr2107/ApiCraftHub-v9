
import express from 'express';
import fs from 'fs';
import path from 'path';
import { RequestSchema } from '@shared/schema';

const router = express.Router();
const API_FOLDER = path.join(process.cwd(), 'client', 'api');

// Get all requests
router.get('/', (req, res) => {
  try {
    const apiFolder = path.join(process.cwd(), 'client', 'api');
    if (!fs.existsSync(apiFolder)) {
      fs.mkdirSync(apiFolder, { recursive: true });
    }

    const files = fs.readdirSync(apiFolder).filter(file => file.endsWith('.json'));
    const requests = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(apiFolder, file),
          'utf-8'
        );
        const request = JSON.parse(content);
        requests.push(request);
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
      }
    }

    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// Get a specific request
router.get('/open/:routeId', (req, res) => {
  try {
    const { routeId } = req.params;
    const apiFolder = path.join(process.cwd(), 'client', 'api');

    if (!fs.existsSync(apiFolder)) {
      fs.mkdirSync(apiFolder, { recursive: true });
    }

    const requestFile = fs.readdirSync(apiFolder)
      .find(file => file.startsWith(routeId) && file.endsWith('.json'));

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const content = fs.readFileSync(
      path.join(apiFolder, requestFile),
      'utf-8'
    );
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Error loading request:', error);
    res.status(500).json({ error: 'Failed to load request' });
  }
});

// Save/update a request
router.post('/save', (req, res) => {
  try {
    const apiFolder = path.join(process.cwd(), 'client', 'api');
    if (!fs.existsSync(apiFolder)) {
      fs.mkdirSync(apiFolder, { recursive: true });
    }

    // Validate request with schema
    const request = RequestSchema.parse(req.body);

    const fileName = `${request.routeId}.json`;
    fs.writeFileSync(
      path.join(apiFolder, fileName),
      JSON.stringify(request, null, 2)
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

// Delete a request
router.delete('/:routeId', (req, res) => {
  try {
    const { routeId } = req.params;
    const apiFolder = path.join(process.cwd(), 'client', 'api');
    
    const requestFile = fs.readdirSync(apiFolder)
      .find(file => file.startsWith(routeId) && file.endsWith('.json'));

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    fs.unlinkSync(path.join(apiFolder, requestFile));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
