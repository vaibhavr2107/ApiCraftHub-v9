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

// Temporary directory for cloning repositories
const TEMP_DIR = path.join(__dirname, '../temp');

// Helper function to ensure temp directory exists
const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

// GitHub import route
router.post('/github', async (req, res) => {
  try {
    const importData = githubImportSchema.parse(req.body);
    console.log('Starting GitHub import for project:', importData.projectName);

    ensureTempDir();
    const repoDir = path.join(TEMP_DIR, importData.projectName);

    // Clean up any existing directory
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    // Clone repository
    const gitUrl = importData.githubUrl.replace('https://', '');
    const gitCommand = `git clone https://${importData.username}:${importData.password}@${gitUrl} ${repoDir}`;
    execSync(gitCommand);

    // Scan for endpoints
    const { endpoints, models } = await SpringParser.scanProject(repoDir);

    // Create collection
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: importData.projectName,
      description: `Imported from GitHub: ${importData.githubUrl}`,
      requests: endpoints.map(endpoint => ({
        ...endpoint,
        devUrl: importData.devUrl,
        qa01Url: importData.qa01Url,
        qa02Url: importData.qa02Url,
        qa03Url: importData.qa03Url,
        perfUrl: importData.perfUrl,
      })),
      importData: {
        source: 'github',
        timestamp: new Date().toISOString(),
        projectType: importData.projectType,
      }
    };

    // Save collection
    const collectionsDir = path.join(process.cwd(), 'client', 'collections');
    if (!fs.existsSync(collectionsDir)) {
      fs.mkdirSync(collectionsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(collectionsDir, `${collection.id}.json`),
      JSON.stringify(collection, null, 2)
    );

    // Cleanup
    fs.rmSync(repoDir, { recursive: true, force: true });

    res.json(collection);
  } catch (error) {
    console.error('GitHub import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import from GitHub'
    });
  }
});

// WSDL import route
router.post('/wsdl', async (req, res) => {
  try {
    const { url } = wsdlImportSchema.parse(req.body);

    // Fetch WSDL content
    const response = await axios.get(url);
    const wsdlContent = response.data;

    // TODO: Implement WSDL parsing logic
    // For now, return a basic collection
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: `WSDL Import ${new Date().toISOString()}`,
      description: `Imported from WSDL: ${url}`,
      requests: [],
      importData: {
        source: 'wsdl',
        timestamp: new Date().toISOString(),
        url
      }
    };

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

    // Fetch OpenAPI content
    const response = await axios.get(url);
    const content = response.data;

    // Parse OpenAPI spec
    const spec = typeof content === 'string' ? yaml.load(content) : content;

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: `OpenAPI Import ${new Date().toISOString()}`,
      description: `Imported from OpenAPI: ${url}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: 'openapi',
        timestamp: new Date().toISOString(),
        url,
        spec
      }
    };

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

    // Add import metadata
    collection.importData = {
      source: 'file',
      timestamp: new Date().toISOString(),
      fileName
    };

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

    // Parse OpenAPI content
    const spec = yaml.load(content);

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
      description: `Imported from OpenAPI file: ${fileName}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: 'openapi_file',
        timestamp: new Date().toISOString(),
        fileName,
        spec
      }
    };

    res.json(collection);
  } catch (error) {
    console.error('OpenAPI file import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import OpenAPI file'
    });
  }
});

export default router;