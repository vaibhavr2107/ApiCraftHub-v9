import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import { RequestSchema } from "@shared/schema";
import requestRoutes from "./routes/requests";
import importRoutes from "./routes/import";
import express from 'express';

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Add JSON parsing middleware with increased limit for file uploads
  app.use(express.json({ limit: '50mb' }));

  // API routes should be handled first
  app.use('/api', (req, res, next) => {
    // Set JSON content type for all API routes
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Register API routes
  app.use('/api', requestRoutes);
  app.use('/api/import', importRoutes);  // Add the import routes

  // History routes
  app.get('/api/history/:routeId', (req, res) => {
    try {
      const apiFolder = path.join(process.cwd(), 'client', 'api');
      if (!fs.existsSync(apiFolder)) {
        fs.mkdirSync(apiFolder, { recursive: true });
      }

      const { routeId } = req.params;
      const historyFile = fs.readdirSync(apiFolder)
        .find(file => file.startsWith(routeId) && file.endsWith('.json'));

      if (!historyFile) {
        return res.status(404).json({ error: 'History request not found' });
      }

      const content = fs.readFileSync(
        path.join(apiFolder, historyFile),
        'utf-8'
      );
      res.json(JSON.parse(content));
    } catch (error) {
      console.error('Error loading history request:', error);
      res.status(500).json({ error: 'Failed to load history request' });
    }
  });

  app.post('/api/history', (req, res) => {
    try {
      const apiFolder = path.join(process.cwd(), 'client', 'api');
      if (!fs.existsSync(apiFolder)) {
        fs.mkdirSync(apiFolder, { recursive: true });
      }

      // Get list of existing history files
      const historyFiles = fs.readdirSync(apiFolder)
        .filter(file => file.includes('history-') && file.endsWith('.json'))
        .sort((a, b) => {
          // Extract timestamps for better sorting
          const getTimestamp = (filename) => {
            const matches = filename.match(/\d+/g);
            return matches ? matches[matches.length - 1] : 0;
          };
          // Sort descending (newest first)
          return parseInt(getTimestamp(b)) - parseInt(getTimestamp(a));
        });

      // Save new history file
      const request = req.body;
      const timestamp = new Date().getTime();
      const fileName = `${request.routeId}-${timestamp}.json`;

      fs.writeFileSync(
        path.join(apiFolder, fileName),
        JSON.stringify(request, null, 2)
      );

      // Remove oldest files if we exceed max (after adding new one)
      if (historyFiles.length >= 9) { // 9 + the one we just added = 10 total
        console.log(`Removing old history files: total count ${historyFiles.length + 1}`);
        historyFiles.slice(9).forEach(file => {
          console.log(`Removing old history file: ${file}`);
          fs.unlinkSync(path.join(apiFolder, file));
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error saving history request:', error);
      res.status(500).json({ error: 'Failed to save history request' });
    }
  });

  // Proxy route for making external API calls
  app.post('/api/proxy', async (req, res) => {
    try {
      const { method, url, headers = {}, body } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Ensure URL is properly formatted
      const requestUrl = url.startsWith('http') ? url : `https://${url}`;

      // Prepare fetch options
      const options: RequestInit = {
        method,
        headers: { ...headers },
      };

      // Add body for non-GET requests
      if (method !== 'GET' && body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // Make the request
      const startTime = performance.now();
      const response = await fetch(requestUrl, options);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Process response
      const responseData = await (async () => {
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          }
          return await response.text();
        } catch (error) {
          return await response.text();
        }
      })();

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Create response object
      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        time: Math.round(responseTime),
        size: JSON.stringify(responseData).length
      };

      // Forward the actual status code from the original request
      res.status(response.status).json(result);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ 
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: error instanceof Error ? error.message : 'An unknown error occurred' },
        time: 0,
        size: 0
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