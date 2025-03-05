import type { Express } from "express";
import { createServer, type Server } from "http";
import express from 'express';
import requestRoutes from "./routes/requests";
import importRoutes from "./routes/import";
import historyRoutes from "./routes/history";
import proxyRoutes from "./routes/proxy";
import collectionsRoutes from "./routes/collections";

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
  app.use('/api/requests', requestRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/proxy', proxyRoutes);

  // Collections routes - no /api prefix as these are static files
  app.use('/collections', collectionsRoutes);

  const httpServer = createServer(app);
  return httpServer;
}