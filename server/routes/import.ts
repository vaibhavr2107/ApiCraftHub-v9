import express from 'express';
import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SpringParser } from '../parser/SpringParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Validation schema for import request
const importRequestSchema = z.object({
  serviceName: z.string(),
  devUrl: z.string().optional(),
  qa01Url: z.string().optional(),
  qa02Url: z.string().optional(),
  qa03Url: z.string().optional(),
  perfUrl: z.string().optional(),
  gitUrl: z.string(),
  username: z.string(),
  password: z.string(),
});

// Temporary directory for cloning repositories
const TEMP_DIR = path.join(__dirname, '../temp');

router.post('/import', async (req, res) => {
  try {
    const importData = importRequestSchema.parse(req.body);
    console.log('Starting import for service:', importData.serviceName);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const repoDir = path.join(TEMP_DIR, importData.serviceName);

    // Clean up any existing directory
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    // Clone repository
    console.log('Cloning repository...');
    const gitUrl = importData.gitUrl.replace('https://', '');
    const gitCommand = `git clone https://${importData.username}:${importData.password}@${gitUrl} ${repoDir}`;
    execSync(gitCommand);
    console.log('Repository cloned successfully');

    // Scan for endpoints using the new parser
    console.log('Scanning for endpoints...');
    const { endpoints, models } = await SpringParser.scanProject(repoDir);
    console.log(`Found ${endpoints.length} endpoints`);

    // Clean up
    fs.rmSync(repoDir, { recursive: true, force: true });

    // Save import metadata
    const importMetadata = {
      timestamp: new Date().toISOString(),
      serviceName: importData.serviceName,
      gitUrl: importData.gitUrl,
      environments: {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
      endpointStats: {
        total: endpoints.length,
        rest: endpoints.filter(e => e.type === 'REST').length,
        soap: endpoints.filter(e => e.type === 'SOAP').length,
      },
      models
    };

    const importDir = path.join(process.cwd(), 'client', 'import');
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(importDir, `import-${importData.serviceName.toLowerCase()}.json`),
      JSON.stringify(importMetadata, null, 2)
    );

    res.json({
      message: 'Import completed successfully',
      endpoints,
      stats: importMetadata.endpointStats
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import service'
    });
  }
});

export default router;