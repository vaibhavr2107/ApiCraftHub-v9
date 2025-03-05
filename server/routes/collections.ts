
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Get all collections
router.get('/', (req, res) => {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(COLLECTIONS_DIR)) {
      fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(COLLECTIONS_DIR)
      .filter(file => file.endsWith('.json'));

    res.json(files);
  } catch (error) {
    console.error('Error reading collections directory:', error);
    res.status(500).json({ error: 'Failed to read collections' });
  }
});

// Get a specific collection
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(COLLECTIONS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Collection file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Error reading collection file:', error);
    res.status(500).json({ error: 'Failed to read collection file' });
  }
});

export default router;
