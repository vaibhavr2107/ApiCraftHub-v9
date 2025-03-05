
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const API_FOLDER = path.join(process.cwd(), 'client', 'api');

// Get history for a specific request
router.get('/:routeId', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    const { routeId } = req.params;
    const historyFile = fs.readdirSync(API_FOLDER)
      .find(file => file.startsWith(routeId) && file.endsWith('.json'));

    if (!historyFile) {
      return res.status(404).json({ error: 'History request not found' });
    }

    const content = fs.readFileSync(
      path.join(API_FOLDER, historyFile),
      'utf-8'
    );
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Error loading history request:', error);
    res.status(500).json({ error: 'Failed to load history request' });
  }
});

// Create a new history entry
router.post('/', (req, res) => {
  try {
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    // Get list of existing history files
    const historyFiles = fs.readdirSync(API_FOLDER)
      .filter(file => file.includes('history-') && file.endsWith('.json'))
      .sort((a, b) => {
        // Extract timestamps for better sorting
        const getTimestamp = (filename) => {
          const matches = filename.match(/\d+/g);
          return matches ? matches[matches.length - 1] : 0;
        };
        // Sort descending (newest first)
        return parseInt(getTimestamp(b)) - parseInt(getTimestamp(a));
      });

    // Save new history file
    const request = req.body;
    const timestamp = new Date().getTime();
    const fileName = `${request.routeId}-${timestamp}.json`;

    fs.writeFileSync(
      path.join(API_FOLDER, fileName),
      JSON.stringify(request, null, 2)
    );

    // Remove oldest files if we exceed max (after adding new one)
    if (historyFiles.length >= 9) { // 9 + the one we just added = 10 total
      console.log(`Removing old history files: total count ${historyFiles.length + 1}`);
      historyFiles.slice(9).forEach(file => {
        console.log(`Removing old history file: ${file}`);
        fs.unlinkSync(path.join(API_FOLDER, file));
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving history request:', error);
    res.status(500).json({ error: 'Failed to save history request' });
  }
});

export default router;
