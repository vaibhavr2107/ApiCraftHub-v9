
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import { Collection } from '@shared/schema';
import { ApiDefinitionService } from '../../services/ApiDefinitionService';

const router = express.Router();

// Get the directory path from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import directories
// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, "../../temp");
const IMPORTS_DIR = path.join(process.cwd(), 'client', 'imports');
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Validation schema for WSDL import
const wsdlImportSchema = z.object({
  url: z.string().url(),
});

// Ensure directories exist
const ensureDirectories = () => {
  [TEMP_DIR, IMPORTS_DIR, COLLECTIONS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// WSDL import route
router.post('/', async (req, res) => {
  try {
    const { url } = wsdlImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch WSDL content
    const response = await axios.get(url);
    const wsdlContent = response.data;

    // Create a temporary file to store the WSDL
    ensureDirectories();
    const tempFilePath = path.join(TEMP_DIR, `${importId}.wsdl`);
    fs.writeFileSync(tempFilePath, wsdlContent);

    // Extract requests
    const requests = await ApiDefinitionService.extractWsdlRequests(
      wsdlContent,
      {
        dev: req.body.devUrl,
        qa01: req.body.qa01Url,
        qa02: req.body.qa02Url,
        qa03: req.body.qa03Url,
        perf: req.body.perfUrl,
      },
    );

    // Save requests
    const stats = await ApiDefinitionService.createRequests(requests);

    // Create a collection
    const urlObj = new URL(url);
    const serviceName =
      urlObj.pathname.split("/").pop()?.replace(".wsdl", "") || "WSDLService";

    const collection: Collection = {
      id: importId,
      name: `${serviceName} (WSDL)`,
      description: `Imported from WSDL: ${url}`,
      requests,
      importData: {
        source: "wsdl",
        timestamp,
        url: url,
        stats,
      },
    };

    const importMetadata = {
      id: importId,
      timestamp,
      type: "wsdl",
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

    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      collection,
      stats,
    });
  } catch (error) {
    console.error("WSDL import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import from WSDL",
    });
  }
});

export default router;
