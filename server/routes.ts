import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

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
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      // Add body if present
      if (body) {
        if (body instanceof FormData) {
          requestOptions.body = body;
        } else if (typeof body === 'string') {
          requestOptions.body = body;
        } else {
          requestOptions.body = JSON.stringify(body);
        }
      }

      // Make the request
      const startTime = Date.now();
      const response = await fetch(requestUrl, requestOptions);
      const endTime = Date.now();

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response data
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Send response
      res.json({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        time: endTime - startTime,
        size: new TextEncoder().encode(JSON.stringify(data)).length
      });

    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).json({
        message: error.message || 'Internal server error',
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