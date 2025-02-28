import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import https from 'https';
import http from 'http';
import fs from 'fs';
import cors from 'cors';
import path from 'path';

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// API routes error handling middleware
app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    // Ensure JSON response for API errors
    res.setHeader('Content-Type', 'application/json');
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ error: message });
  } else {
    next(err);
  }
});

(async () => {
  let server;

  // HTTPS configuration
  const useHttps = process.env.USE_HTTPS === 'true';
  const certPath = process.env.CERT_PATH || path.join(process.cwd(), 'certificates');

  if (useHttps) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(path.join(certPath, 'key.pem')),
        cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
      };
      server = https.createServer(httpsOptions, app);
      log('HTTPS server created with provided certificates');
    } catch (error) {
      log('Error loading HTTPS certificates, falling back to HTTP server');
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // Register API routes first
  await registerRoutes(app);

  // Setup Vite or serve static files
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Generic error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // If headers already sent, let default Express error handler deal with it
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Set appropriate content type based on the request path
    if (req.path.startsWith('/api')) {
      res.setHeader('Content-Type', 'application/json');
      res.status(status).json({ error: message });
    } else {
      res.status(status).send(message);
    }
  });

  // Start server on port 5000
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server is running on ${useHttps ? 'HTTPS' : 'HTTP'} port ${port}`);
  });
})();