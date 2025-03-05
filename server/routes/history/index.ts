
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure __filename and __dirname are properly defined for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Directory where history is stored
const HISTORY_DIR = path.join(process.cwd(), 'client', 'history');

// Ensure the history directory exists
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Get history for a request
router.get('/:historyId', (req, res) => {
  try {
    const { historyId } = req.params;
    const filePath = path.join(HISTORY_DIR, `${historyId}.json`);

    if (!fs.existsSync(filePath)) {
      // If history file doesn't exist, return empty array
      return res.json([]);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const history = JSON.parse(content);
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Add a request to history
router.post('/', (req, res) => {
  try {
    const schema = z.object({
      historyId: z.string(),
      request: z.object({
        timestamp: z.string().optional(),
        requestData: z.any(),
        responseData: z.any().optional(),
        duration: z.number().optional(),
        status: z.number().optional(),
        statusText: z.string().optional(),
        error: z.any().optional()
      })
    });

    const { historyId, request } = schema.parse(req.body);
    const filePath = path.join(HISTORY_DIR, `${historyId}.json`);

    // Set timestamp if not provided
    if (!request.timestamp) {
      request.timestamp = new Date().toISOString();
    }

    // Load existing history or create new array
    let history = [];
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        history = JSON.parse(content);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (error) {
        console.error(`Error parsing history file ${filePath}:`, error);
      }
    }

    // Add new request to history (at the beginning)
    history.unshift(request);

    // Keep only the last 20 items
    if (history.length > 20) {
      history = history.slice(0, 20);
    }

    // Save updated history
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving history:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to save history' });
  }
});

// Clear history for a request
router.delete('/:historyId', (req, res) => {
  try {
    const { historyId } = req.params;
    const filePath = path.join(HISTORY_DIR, `${historyId}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

export default router;
