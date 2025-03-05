
import express from 'express';
import { z } from 'zod';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure __filename and __dirname are properly defined for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Schema for proxy request
const proxyRequestSchema = z.object({
  method: z.string(),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.any().optional(),
  auth: z.object({
    type: z.string(),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional()
  }).optional()
});

router.post('/', async (req, res) => {
  try {
    // Validate request data
    const { method, url, headers = {}, queryParams = {}, body, auth } = proxyRequestSchema.parse(req.body);

    // Build URL with query parameters
    const urlObj = new URL(url);
    for (const [key, value] of Object.entries(queryParams)) {
      urlObj.searchParams.append(key, value);
    }

    // Set up request headers
    const requestHeaders = { ...headers };

    // Add authorization headers
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        requestHeaders['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic' && auth.username && auth.password) {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        requestHeaders['Authorization'] = `Basic ${credentials}`;
      }
    }

    // Make the request
    const startTime = Date.now();
    const response = await fetch(urlObj.toString(), {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const duration = Date.now() - startTime;

    // Get response data
    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Send back the response
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      duration
    });
  } catch (error) {
    console.error('Proxy request error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to execute proxy request' });
  }
});

export default router;
