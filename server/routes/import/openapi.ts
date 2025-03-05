import express from 'express';
import axios from 'axios';
import yaml from 'js-yaml';
import crypto from 'crypto';
import https from 'https';
import { fileURLToPath } from 'url';
import { ApiEnvironments } from '../../types/api';
import { ApiDefinitionService } from '../../services/ApiDefinitionService';

const router = express.Router();

// Function to generate a unique import ID
function generateImportId() {
  return crypto.randomBytes(8).toString('hex');
}

// Import from OpenAPI URL
router.post('/openapi', async (req, res) => {
  const { url } = req.body;
  console.log('OpenAPI import request body:', req.body);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`Processing OpenAPI import from URL: ${url}`);

    // Fetch the OpenAPI content
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Only reject if status >= 500
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    const content = response.data;

    console.log(`Successfully fetched OpenAPI content from ${url}`);

    // Parse OpenAPI spec
    const spec = typeof content === 'string' ? yaml.load(content) : content;

    if (!spec || typeof spec !== 'object') {
      return res.status(400).json({ error: 'Invalid OpenAPI specification' });
    }

    // Extract API title from spec
    const apiTitle = (spec.info && spec.info.title) ? spec.info.title : 'Imported API';

    // Create environments from server URLs if available
    const environments: ApiEnvironments = {};

    if (spec.servers && Array.isArray(spec.servers)) {
      spec.servers.forEach((server, index) => {
        if (server.url) {
          const envKey = server.description?.toLowerCase().replace(/\s+/g, '') || `env${index + 1}`;
          environments[envKey] = server.url;
        }
      });
    }

    // Default environment if none specified
    if (Object.keys(environments).length === 0) {
      environments.default = 'https://api.example.com';
    }

    // Convert OpenAPI to requests
    const requests = ApiDefinitionService.extractOpenApiRequests(spec, environments);

    if (!requests || requests.length === 0) {
      return res.status(400).json({ error: 'No valid requests found in the OpenAPI specification' });
    }

    // Save the requests
    const result = await ApiDefinitionService.createRequests(requests);

    // Create import metadata
    const timestamp = new Date().toISOString();
    const importId = generateImportId();

    const importMetadata = {
      id: importId,
      timestamp,
      url: url,
      environments,
      collectionName: apiTitle,
      requestCount: requests.length
    };

    console.log('Import complete:', importMetadata);

    res.json({
      message: 'OpenAPI import successful',
      imported: result.success,
      updated: result.updated,
      failed: result.failure,
      metadata: importMetadata
    });
  } catch (error) {
    console.error('OpenAPI import error:', error);
    res.status(500).json({
      error: 'Failed to import OpenAPI specification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;