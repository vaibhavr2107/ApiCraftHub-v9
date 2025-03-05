import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { Collection } from '@shared/schema';

const router = express.Router();

// Import directories
const IMPORTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'imports');
const COLLECTIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'collections');

// Validation schema for file import
const fileImportSchema = z.object({
  content: z.string(),
  fileName: z.string(),
});

// Ensure directories exist
const ensureDirectories = () => {
  [IMPORTS_DIR, COLLECTIONS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Collection file import route
router.post('/collection', async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const collection = JSON.parse(content);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    ensureDirectories();

    // Add import metadata
    collection.importData = {
      source: "file",
      timestamp: timestamp,
      fileName,
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: "file",
      fileName,
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json(collection);
  } catch (error) {
    console.error("Collection import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import collection",
    });
  }
});

// OpenAPI file import route
router.post('/openapi', async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    ensureDirectories();

    // Parse OpenAPI content
    const spec = yaml.load(content);

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: importId,
      name: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension
      description: `Imported from OpenAPI file: ${fileName}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: "openapi_file",
        timestamp: timestamp,
        fileName,
        spec,
      },
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: "openapi_file",
      fileName,
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json(collection);
  } catch (error) {
    console.error("OpenAPI file import error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to import OpenAPI file",
    });
  }
});

export default router;