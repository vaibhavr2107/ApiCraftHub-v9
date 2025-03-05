
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const router = express.Router();

// Proxy route for making external API calls
router.post('/', async (req, res) => {
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

export default router;
