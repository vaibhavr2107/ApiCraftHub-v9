
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Collection } from '@shared/schema';

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

// Get all collections
router.get('/', (req, res) => {
  try {
    const collections = [];
    const files = fs.readdirSync(COLLECTIONS_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8');
        try {
          const collection = JSON.parse(content);
          collections.push(collection);
        } catch (error) {
          console.error(`Error parsing collection file ${file}:`, error);
        }
      }
    }

    res.json(collections);
  } catch (error) {
    console.error('Error getting collections:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

// Get a collection by ID
router.get('/:collectionId', (req, res) => {
  try {
    const { collectionId } = req.params;
    const filePath = path.join(COLLECTIONS_DIR, `${collectionId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const collection = JSON.parse(content);
    res.json(collection);
  } catch (error) {
    console.error('Error getting collection:', error);
    res.status(500).json({ error: 'Failed to get collection' });
  }
});

// Create a new collection
router.post('/', (req, res) => {
  try {
    const collectionSchema = z.object({
      name: z.string(),
      description: z.string().optional(),
      requests: z.array(z.any()).optional(),
      importData: z.object({
        source: z.string(),
        timestamp: z.string(),
        projectType: z.string().optional()
      }).optional()
    });

    const validatedData = collectionSchema.parse(req.body);
    const collectionId = validatedData.id || crypto.randomUUID();
    const collection: Collection = {
      id: collectionId,
      name: validatedData.name,
      description: validatedData.description || '',
      requests: validatedData.requests || [],
      importData: validatedData.importData
    };

    const filePath = path.join(COLLECTIONS_DIR, `${collectionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));

    res.status(201).json({ success: true, collection });
  } catch (error) {
    console.error('Error creating collection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Update a collection
router.put('/:collectionId', (req, res) => {
  try {
    const { collectionId } = req.params;
    const filePath = path.join(COLLECTIONS_DIR, `${collectionId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const existingCollection = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updatedCollection = { ...existingCollection, ...req.body, id: collectionId };

    fs.writeFileSync(filePath, JSON.stringify(updatedCollection, null, 2));
    res.json({ success: true, collection: updatedCollection });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// Delete a collection
router.delete('/:collectionId', (req, res) => {
  try {
    const { collectionId } = req.params;
    const filePath = path.join(COLLECTIONS_DIR, `${collectionId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

export default router;
