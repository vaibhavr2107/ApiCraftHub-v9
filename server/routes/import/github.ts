
import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Collection } from '@shared/schema';
import { ApiDefinitionService } from '../../services/ApiDefinitionService';

const router = express.Router();

// Get the directory path from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import directories
const IMPORTS_DIR = path.join(process.cwd(), 'client', 'imports');
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Validation schema for GitHub import
const githubImportSchema = z.object({
  projectName: z.string(),
  projectType: z.enum(["REST", "SOAP", "BOTH"]),
  wsdlPath: z.string().optional(),
  openApiPath: z.string().optional(),
  devUrl: z.string().url().optional(),
  qa01Url: z.string().url().optional(),
  qa02Url: z.string().url().optional(),
  qa03Url: z.string().url().optional(),
  perfUrl: z.string().url().optional(),
  githubUrl: z.string().url(),
  username: z.string(),
  password: z.string(),
});

// Ensure directories exist
const ensureDirectories = () => {
  [IMPORTS_DIR, COLLECTIONS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// GitHub import route
router.post('/', async (req, res) => {
  try {
    const importData = githubImportSchema.parse(req.body);
    console.log("Starting GitHub import for project:", importData.projectName);

    // Generate import UUID
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Save import metadata
    const importMetadata = {
      id: importId,
      timestamp,
      type: "github",
      projectName: importData.projectName,
      projectType: importData.projectType,
      githubUrl: importData.githubUrl,
      environments: {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
    };

    ensureDirectories();

    // Save import metadata
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );

    // Process GitHub repository
    const result = await ApiDefinitionService.processGithubRepo(
      importData.githubUrl,
      importData.username,
      importData.password,
      importData.projectName,
      importData.wsdlPath,
      importData.openApiPath,
      {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
    );

    // Create collection
    const collection: Collection = {
      id: importId,
      name: importData.projectName,
      description: `Imported from GitHub: ${importData.githubUrl}`,
      requests: result.requests,
      importData: {
        source: "github",
        timestamp,
        projectType: result.type,
        stats: result.stats,
      },
    };

    // Save collection
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json({
      importId,
      collection,
      result,
    });
  } catch (error) {
    console.error("GitHub import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import from GitHub",
    });
  }
});

export default router;
