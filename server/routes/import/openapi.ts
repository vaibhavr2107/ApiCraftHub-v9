
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import yaml from 'js-yaml';
import https from 'https';
import { Collection } from '@shared/schema';
import { ApiDefinitionService } from '../../services/ApiDefinitionService';

const router = express.Router();

// Import directories
const IMPORTS_DIR = path.join(process.cwd(), 'client', 'imports');
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Validation schema for OpenAPI import
const openApiImportSchema = z.object({
  url: z.string().url("Invalid OpenAPI URL"),
  devUrl: z.string().url().optional(),
  qa01Url: z.string().url().optional(),
  qa02Url: z.string().url().optional(),
  qa03Url: z.string().url().optional(),
  perfUrl: z.string().url().optional(),
});

// Ensure directories exist
const ensureDirectories = () => {
  [IMPORTS_DIR, COLLECTIONS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// OpenAPI URL import route
router.post('/', async (req, res) => {
  console.log("OpenAPI import request body:", req.body);
  try {
    // Validate request body
    const { url } = openApiImportSchema.parse(req.body);

    // If we got here, we have a valid URL
    console.log(`Processing OpenAPI import from URL: ${url}`);

    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch OpenAPI content with a timeout and disable certificate validation for testing
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Only reject if status >= 500
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    const content = response.data;

    console.log(`Successfully fetched OpenAPI content from ${url}`);

    // Parse OpenAPI spec
    const spec = typeof content === "string" ? yaml.load(content) : content;

    // Get API title from spec
    const apiTitle = spec.info?.title || "OpenAPI";

    // Define environments from request body
    const environments = {
      dev: req.body.devUrl || "",
      qa01: req.body.qa01Url || "",
      qa02: req.body.qa02Url || "",
      qa03: req.body.qa03Url || "",
      perf: req.body.perfUrl || "",
    };

    // Extract requests
    const requests = ApiDefinitionService.extractOpenApiRequests(
      spec,
      environments,
    );

    // Save requests
    const stats = await ApiDefinitionService.createRequests(requests);

    // Ensure import directory exists
    ensureDirectories();
    
    // Create import directory path
    const importDir = path.join(process.cwd(), 'client', 'import');
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }

    // Save import details for reference
    fs.writeFileSync(
      path.join(importDir, `openapi-import-${importId}.json`),
      JSON.stringify(
        {
          id: importId,
          timestamp,
          url: url,
          environments,
          collectionName: apiTitle,
          requestCount: requests.length,
        },
        null,
        2,
      ),
    );

    // Create a collection
    const collection: Collection = {
      id: importId,
      name: apiTitle,
      description: `Imported from OpenAPI: ${url}`,
      requests,
      importData: {
        source: "openapi",
        timestamp,
        url: url,
        stats,
      },
    };

    const importMetadata = {
      id: importId,
      timestamp,
      type: "openapi",
      url: url,
      stats,
    };

    // Save metadata and collection
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );

    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json({
      collection,
      stats,
    });
  } catch (error) {
    console.error("OpenAPI import error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to import from OpenAPI",
    });
  }
});

export default router;
