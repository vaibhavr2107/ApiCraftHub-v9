import express from 'express';
import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SpringParser } from '../parser/SpringParser';
import axios from 'axios';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { Collection, Request } from '@shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Import directories
const TEMP_DIR = path.join(__dirname, '../temp');
const IMPORTS_DIR = path.join(process.cwd(), 'client', 'imports');
const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

// Ensure directories exist
const ensureDirectories = () => {
  [TEMP_DIR, IMPORTS_DIR, COLLECTIONS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Validation schemas for different import types
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

const wsdlImportSchema = z.object({
  url: z.string().url(),
});

const openApiImportSchema = z.object({
  url: z.string().url(),
});

const fileImportSchema = z.object({
  content: z.string(),
  fileName: z.string(),
});


// GitHub import route
router.post('/github', async (req, res) => {
  try {
    const importData = githubImportSchema.parse(req.body);
    console.log('Starting GitHub import for project:', importData.projectName);

    // Generate import UUID
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Save import metadata
    const importMetadata = {
      id: importId,
      timestamp,
      type: 'github',
      projectName: importData.projectName,
      projectType: importData.projectType,
      githubUrl: importData.githubUrl,
      environments: {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      }
    };

    ensureDirectories();

    // Save import metadata
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2)
    );

    // Clone repository
    const repoDir = path.join(TEMP_DIR, importId);
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    const gitUrl = importData.githubUrl.replace('https://', '');
    const gitCommand = `git clone https://${importData.username}:${importData.password}@${gitUrl} ${repoDir}`;
    execSync(gitCommand);

    let requests: Request[] = [];

    // Process WSDL if needed
    if (importData.projectType === 'SOAP' || importData.projectType === 'BOTH') {
      const wsdlPath = path.join(repoDir, importData.wsdlPath || '');
      if (fs.existsSync(wsdlPath)) {
        // TODO: Implement WSDL scanning
        console.log('Scanning WSDL files in:', wsdlPath);
      }
    }

    // Process OpenAPI if needed
    if (importData.projectType === 'REST' || importData.projectType === 'BOTH') {
      const openApiPath = path.join(repoDir, importData.openApiPath || '');
      if (fs.existsSync(openApiPath)) {
        // Scan for OpenAPI files
        const files = fs.readdirSync(openApiPath);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
            const content = fs.readFileSync(path.join(openApiPath, file), 'utf8');
            const spec = file.endsWith('.json') ? JSON.parse(content) : yaml.load(content);

            // Convert OpenAPI spec to requests
            const openApiRequests = processOpenAPISpec(spec, importMetadata.environments);
            requests = [...requests, ...openApiRequests];
          }
        }
      }
    }

    // Create collection
    const collection: Collection = {
      id: importId,
      name: importData.projectName,
      description: `Imported from GitHub: ${importData.githubUrl}`,
      requests,
      importData: {
        source: 'github',
        timestamp,
        projectType: importData.projectType,
      }
    };

    // Save collection
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );

    // Cleanup
    fs.rmSync(repoDir, { recursive: true, force: true });

    res.json({
      importId,
      collection
    });
  } catch (error) {
    console.error('GitHub import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import from GitHub'
    });
  }
});

// Helper function to process OpenAPI spec
function processOpenAPISpec(spec: any, environments: any): Request[] {
  const requests: Request[] = [];

  if (spec.paths) {
    Object.entries(spec.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        const operationId = operation.operationId || `${method}-${path}`;
        const requestId = crypto.randomUUID();

        requests.push({
          requestId,
          routeId: requestId,
          name: operation.summary || operationId,
          method: method.toUpperCase(),
          baseUrl: path,
          queryParams: {},
          pathVariables: {},
          headers: {},
          auth: { type: "none" },
          requestBody: operation.requestBody?.content?.['application/json']?.example || {},
          responseFields: {},
          devUrl: environments.dev,
          qa01Url: environments.qa01,
          qa02Url: environments.qa02,
          qa03Url: environments.qa03,
          perfUrl: environments.perf,
          historyId: crypto.randomUUID(),
          historyRequests: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          selectedEnvironment: "qa01",
          exampleResponseBody: {},
          tags: operation.tags || [],
          collectionId: spec.info?.title || 'imported-collection',
          collectionName: spec.info?.title || 'Imported Collection'
        });
      });
    });
  }

  return requests;
}

// WSDL import route
router.post('/wsdl', async (req, res) => {
  try {
    const { url } = wsdlImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch WSDL content
    const response = await axios.get(url);
    const wsdlContent = response.data;

    // TODO: Implement WSDL parsing logic
    // For now, return a basic collection
    const collection: Collection = {
      id: importId,
      name: `WSDL Import ${new Date().toISOString()}`,
      description: `Imported from WSDL: ${url}`,
      requests: [],
      importData: {
        source: 'wsdl',
        timestamp: timestamp,
        url
      }
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: 'wsdl',
      url
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2)
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );
    res.json(collection);
  } catch (error) {
    console.error('WSDL import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import from WSDL'
    });
  }
});

// OpenAPI URL import route
router.post('/openapi', async (req, res) => {
  try {
    const { url } = openApiImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch OpenAPI content
    const response = await axios.get(url);
    const content = response.data;

    // Parse OpenAPI spec
    const spec = typeof content === 'string' ? yaml.load(content) : content;

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: importId,
      name: `OpenAPI Import ${new Date().toISOString()}`,
      description: `Imported from OpenAPI: ${url}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: 'openapi',
        timestamp: timestamp,
        url,
        spec
      }
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: 'openapi',
      url
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2)
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );

    res.json(collection);
  } catch (error) {
    console.error('OpenAPI import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import from OpenAPI'
    });
  }
});

// Collection file import route
router.post('/collection', async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const collection = JSON.parse(content);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Add import metadata
    collection.importData = {
      source: 'file',
      timestamp: timestamp,
      fileName
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: 'file',
      fileName
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2)
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );

    res.json(collection);
  } catch (error) {
    console.error('Collection import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import collection'
    });
  }
});

// OpenAPI file import route
router.post('/openapi_file', async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Parse OpenAPI content
    const spec = yaml.load(content);

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: importId,
      name: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
      description: `Imported from OpenAPI file: ${fileName}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: 'openapi_file',
        timestamp: timestamp,
        fileName,
        spec
      }
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: 'openapi_file',
      fileName
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2)
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );

    res.json(collection);
  } catch (error) {
    console.error('OpenAPI file import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import OpenAPI file'
    });
  }
});

export default router;