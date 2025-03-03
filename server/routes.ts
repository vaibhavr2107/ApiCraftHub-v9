import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import { RequestSchema } from "@shared/schema";
import requestRoutes from "./routes/requests";
import express from 'express';

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Add JSON parsing middleware
  app.use(express.json());

  // API routes should be handled first
  app.use('/api', (req, res, next) => {
    // Set JSON content type for all API routes
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Register API routes
  app.use('/api', requestRoutes);

  // History routes
  app.get('/api/history/:routeId', (req, res) => {
    try {
      const historyFolder = path.join(process.cwd(), 'client', 'collections', 'history');
      if (!fs.existsSync(historyFolder)) {
        fs.mkdirSync(historyFolder, { recursive: true });
      }

      const { routeId } = req.params;
      const historyFile = fs.readdirSync(historyFolder)
        .find(file => file.startsWith(routeId));

      if (!historyFile) {
        return res.status(404).json({ error: 'History request not found' });
      }

      const content = fs.readFileSync(
        path.join(historyFolder, historyFile),
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
      const historyFolder = path.join(process.cwd(), 'client', 'collections', 'history');
      if (!fs.existsSync(historyFolder)) {
        fs.mkdirSync(historyFolder, { recursive: true });
      }

      // Get list of existing history files
      const files = fs.readdirSync(historyFolder)
        .filter(file => file.endsWith('.json'))
        .sort()
        .reverse();

      // Remove oldest files if we exceed max
      if (files.length >= 10) {
        files.slice(9).forEach(file => {
          fs.unlinkSync(path.join(historyFolder, file));
        });
      }

      // Save new history file
      const request = req.body;
      const timestamp = new Date().getTime();
      const fileName = `${request.routeId}-${timestamp}.json`;
      fs.writeFileSync(
        path.join(historyFolder, fileName),
        JSON.stringify(request, null, 2)
      );

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