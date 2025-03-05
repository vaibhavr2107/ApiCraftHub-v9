
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import route modules
import importRoutes from './routes/import/index.js';
import requestsRoutes from './routes/requests/index.js';
import collectionsRoutes from './routes/collections/index.js';
import historyRoutes from './routes/history/index.js';
import proxyRoutes from './routes/proxy/index.js';

// Create __dirname equivalent for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupRoutes(app) {
  // Enable CORS
  app.use(cors());
  
  // Parse JSON request bodies
  app.use(express.json({ limit: '10mb' }));
  
  // API routes
  app.use('/api/import', importRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/collections', collectionsRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/proxy', proxyRoutes);

  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, '../client')));
  
  // Fallback to index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}
