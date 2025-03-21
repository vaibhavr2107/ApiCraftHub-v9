import type { Express } from "express";
import { createServer as createHttpServer, type Server } from "http";
import { createServer as createHttpsServer } from "https";
import { storage } from "./storage";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import { RequestSchema } from "@shared/schema";
import requestRoutes from "./routes/requests";
import importRoutes from "./routes/import";
import express from 'express';
import cors from 'cors';

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable CORS for all routes
  app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true, // Allow cookies
    maxAge: 86400 // Cache preflight requests for 24 hours
  }));

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

  // Proxy route for making external API calls using axios
  app.post('/api/proxy', async (req, res) => {
    try {
      const { method, url, headers = {}, body } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Ensure URL is properly formatted
      const requestUrl = url.startsWith('http') ? url : `https://${url}`;

      // Prepare axios options with CORS headers
      const options: any = {
        method: method.toLowerCase(), // axios uses lowercase method names
        url: requestUrl,
        headers: { 
          ...headers,
          // Add CORS headers for the outgoing request
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        },
        httpsAgent, // Use the agent that accepts self-signed certificates
        timeout: 30000, // 30 seconds timeout
        validateStatus: () => true, // Don't throw errors for any status code
        maxRedirects: 5, // Follow up to 5 redirects
      };

      // Add body for non-GET requests
      if (method !== 'GET' && body) {
        if (typeof body === 'string') {
          try {
            // Try to parse as JSON
            options.data = JSON.parse(body);
          } catch (e) {
            // If not valid JSON, send as is
            options.data = body;
          }
        } else {
          options.data = body;
        }
      }

      console.log(`Making ${method} request to: ${requestUrl}`);
      
      // Make the request with axios
      const startTime = performance.now();
      const response = await axios(options);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Get response data
      const responseData = response.data;
      
      // Format the headers from axios response (they're already an object)
      const responseHeaders = response.headers;

      // Create response object in a format compatible with our frontend
      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        time: Math.round(responseTime),
        size: JSON.stringify(responseData).length || 0
      };

      // Forward the actual status code from the original request
      res.status(response.status).json(result);
    } catch (error) {
      console.error('Proxy error:', error);
      
      // Determine if the error is from axios
      const axiosError = (error as any)?.isAxiosError === true;
      const errorResponse = axiosError && (error as any)?.response ? (error as any).response : null;
      
      res.status(500).json({ 
        status: 500,
        statusText: 'Internal Server Error',
        data: { 
          message: error instanceof Error ? error.message : 'An unknown error occurred',
          // Include more detailed error info if available
          cause: (error as any)?.cause ? String((error as any).cause) : undefined,
          // If it's an axios error with a response, include that data
          responseData: errorResponse ? errorResponse.data : undefined
        },
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

  // Create HTTP server by default
  const httpServer = createHttpServer(app);
  
  // Check if TLS certificates exist for HTTPS
  const certsPath = path.join(process.cwd(), 'certs');
  let httpsServer = null;
  
  if (fs.existsSync(certsPath)) {
    try {
      const privateKey = fs.existsSync(path.join(certsPath, 'private.key')) 
        ? fs.readFileSync(path.join(certsPath, 'private.key'), 'utf8')
        : null;
      
      const certificate = fs.existsSync(path.join(certsPath, 'certificate.crt'))
        ? fs.readFileSync(path.join(certsPath, 'certificate.crt'), 'utf8')
        : null;
      
      // Only create HTTPS server if both key and certificate exist
      if (privateKey && certificate) {
        const credentials = { key: privateKey, cert: certificate };
        httpsServer = createHttpsServer(credentials, app);
        console.log('HTTPS server created with provided certificates');
        
        // Start HTTPS server on port 443 by default or use environment variable
        const httpsPort = process.env.HTTPS_PORT || 443;
        httpsServer.listen(httpsPort, () => {
          console.log(`HTTPS server is running on port ${httpsPort}`);
        });
      }
    } catch (error) {
      console.error('Error setting up HTTPS server:', error);
    }
  }
  
  // Return the HTTP server for standard operation
  return httpServer;
}