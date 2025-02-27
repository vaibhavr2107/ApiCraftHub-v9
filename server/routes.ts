import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import { RequestSchema } from "@shared/schema";

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes prefix with /api
  app.post('/api/proxy', async (req, res) => {
    try {
      const { method, url, headers = {}, body } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Ensure URL is properly formatted
      const requestUrl = url.startsWith('http') ? url : `https://${url}`;

      // Create request options
      const requestOptions: any = {
        method,
        url: requestUrl,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        httpsAgent,
        validateStatus: null,
      };

      // Add body for non-GET/HEAD requests
      if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
        requestOptions.data = body;
      }

      // Make the request using axios
      const startTime = Date.now();
      const response = await axios(requestOptions);
      const endTime = Date.now();

      // Format headers for response
      const responseHeaders: Record<string, string> = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          responseHeaders[key] = value;
        } else if (Array.isArray(value)) {
          responseHeaders[key] = value.join(', ');
        }
      });

      // Send response
      res.json({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: response.data,
        time: endTime - startTime,
        size: JSON.stringify(response.data).length
      });

    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).json({
        message: error.message || 'Internal server error',
        error: error.toString()
      });
    }
  });

  // New endpoint for saving request files
  app.post('/api/requests', async (req, res) => {
    try {
      const requestData = req.body;

      // Validate request data against schema
      const validatedData = RequestSchema.parse(requestData);

      // Create api directory if it doesn't exist
      const apiDir = path.join(process.cwd(), 'client', 'api');
      if (!fs.existsSync(apiDir)) {
        fs.mkdirSync(apiDir, { recursive: true });
      }

      // Check for existing versions of this request
      const files = fs.readdirSync(apiDir);
      const baseRequestId = validatedData.requestId;
      const versionRegex = new RegExp(`${baseRequestId}-v(\\d+)\\.json`);
      let maxVersion = 0;

      files.forEach(file => {
        const match = file.match(versionRegex);
        if (match) {
          const version = parseInt(match[1]);
          maxVersion = Math.max(maxVersion, version);
        }
      });

      // Increment version for the new file
      const version = maxVersion + 1;
      const fileName = `${baseRequestId}-v${version}.json`;
      const filePath = path.join(apiDir, fileName);

      // Save request data to file
      fs.writeFileSync(filePath, JSON.stringify(validatedData, null, 2));

      res.json({
        message: 'Request saved successfully',
        fileName,
        version
      });

    } catch (error: any) {
      console.error('Error saving request:', error);
      res.status(500).json({
        message: error.message || 'Failed to save request',
        error: error.toString()
      });
    }
  });

  // Endpoint to get all saved requests
  app.get('/api/requests', (req, res) => {
    try {
      const apiDir = path.join(process.cwd(), 'client', 'api');
      if (!fs.existsSync(apiDir)) {
        fs.mkdirSync(apiDir, { recursive: true });
        return res.json([]);
      }

      const files = fs.readdirSync(apiDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(apiDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(content);
        });

      res.json(files);
    } catch (error: any) {
      console.error('Error reading requests:', error);
      res.status(500).json({
        message: error.message || 'Failed to read requests',
        error: error.toString()
      });
    }
  });

  // Collections routes - no /api prefix as these are static files
  app.get('/collections', (req, res) => {
    try {
      const collectionsPath = path.join(process.cwd(), 'client', 'collections');

      // Create directory if it doesn't exist
      if (!fs.existsSync(collectionsPath)) {
        fs.mkdirSync(collectionsPath, { recursive: true });
      }

      const files = fs.readdirSync(collectionsPath)
        .filter(file => file.endsWith('.json'));

      res.json(files);
    } catch (error) {
      console.error('Error reading collections directory:', error);
      res.status(500).json({ error: 'Failed to read collections' });
    }
  });

  app.get('/collections/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(process.cwd(), 'client', 'collections', filename);

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

  const httpServer = createServer(app);
  return httpServer;
}