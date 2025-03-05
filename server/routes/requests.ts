import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const API_FOLDER = path.join(process.cwd(), 'client', 'api');

// Get all requests
router.get('/requests', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    const files = fs.readdirSync(API_FOLDER)
      .filter(file => !file.includes('history-') && file.endsWith('.json'));

    const requests = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(API_FOLDER, file), 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Error parsing request file ${file}:`, error);
        return null;
      }
    }).filter(Boolean);

    res.json(requests);
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// Get a specific request by ID
router.get('/requests/open/:routeId', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    const { routeId } = req.params;
    const requestFile = fs.readdirSync(API_FOLDER)
      .find(file => file.startsWith(routeId) && file.endsWith('.json') && !file.includes('history-'));

    if (!requestFile) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const content = fs.readFileSync(
      path.join(API_FOLDER, requestFile),
      'utf-8'
    );
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Error loading request:', error);
    res.status(500).json({ error: 'Failed to load request' });
  }
});

// Create or update a request
router.post('/requests', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    const request = req.body;
    const fileName = `${request.routeId}.json`;

    fs.writeFileSync(
      path.join(API_FOLDER, fileName),
      JSON.stringify(request, null, 2)
    );

    res.json(request);
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

// Delete a request
router.delete('/requests/:routeId', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    const { routeId } = req.params;
    const file = fs.readdirSync(API_FOLDER)
      .find(file => file.startsWith(routeId) && file.endsWith('.json') && !file.includes('history-'));

    if (!file) {
      return res.status(404).json({ error: 'Request not found' });
    }

    fs.unlinkSync(path.join(API_FOLDER, file));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;