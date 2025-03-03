import express from 'express';
import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Validation schema for import request
const importRequestSchema = z.object({
  serviceName: z.string(),
  devUrl: z.string().optional(),
  qa01Url: z.string().optional(),
  qa02Url: z.string().optional(),
  qa03Url: z.string().optional(),
  perfUrl: z.string().optional(),
  gitUrl: z.string(),
  username: z.string(),
  password: z.string(),
});

// Temporary directory for cloning repositories
const TEMP_DIR = path.join(__dirname, '../temp');

// Regular expressions for Spring annotations
const SPRING_ENDPOINT_PATTERNS = {
  rest: [
    // @RequestMapping with method attribute
    /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*,\s*method\s*=\s*RequestMethod\.(GET|POST|PUT|DELETE|PATCH)\)/g,
    // Direct method annotations
    /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    // Class level RequestMapping
    /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,
  ],
  soap: [
    // @WebService annotation
    /@WebService\s*\(\s*(?:targetNamespace\s*=\s*)?["']([^"']+)["']/g,
    // @SOAPBinding annotation
    /@SOAPBinding\s*\(\s*style\s*=\s*Style\.(DOCUMENT|RPC)/g,
    // @WebMethod annotation
    /@WebMethod\s*\(\s*operationName\s*=\s*["']([^"']+)["']/g
  ],
  requestBody: [
    // @RequestBody annotation with type
    /@RequestBody\s+(\w+(?:<.*?>)?)\s+\w+/g,
    // Return types for response bodies
    /public\s+(\w+(?:<.*?>)?)\s+\w+\s*\([^)]*\)/g
  ]
};

router.post('/import', async (req, res) => {
  try {
    const importData = importRequestSchema.parse(req.body);
    console.log('Starting import for service:', importData.serviceName);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const repoDir = path.join(TEMP_DIR, importData.serviceName);

    // Clean up any existing directory
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    // Clone repository
    console.log('Cloning repository...');
    const gitUrl = importData.gitUrl.replace('https://', '');
    const gitCommand = `git clone https://${importData.username}:${importData.password}@${gitUrl} ${repoDir}`;
    execSync(gitCommand);
    console.log('Repository cloned successfully');

    // Scan for endpoints
    console.log('Scanning for endpoints...');
    const endpoints = await scanSpringRepository(repoDir);
    console.log(`Found ${endpoints.length} endpoints`);

    // Clean up
    fs.rmSync(repoDir, { recursive: true, force: true });

    // Save import metadata
    const importMetadata = {
      timestamp: new Date().toISOString(),
      serviceName: importData.serviceName,
      gitUrl: importData.gitUrl,
      environments: {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
      endpointStats: {
        total: endpoints.length,
        rest: endpoints.filter(e => e.type === 'REST').length,
        soap: endpoints.filter(e => e.type === 'SOAP').length,
      }
    };

    const importDir = path.join(process.cwd(), 'client', 'import');
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(importDir, `import-${importData.serviceName.toLowerCase()}.json`),
      JSON.stringify(importMetadata, null, 2)
    );

    res.json({ 
      message: 'Import completed successfully',
      endpoints,
      stats: importMetadata.endpointStats
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to import service' 
    });
  }
});

interface SpringEndpoint {
  path: string;
  method: string;
  type: 'REST' | 'SOAP';
  requestBody?: {
    type: string;
    fields?: Record<string, string>;
  };
  responseBody?: {
    type: string;
    fields?: Record<string, string>;
  };
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  headers: Record<string, string>;
}

async function scanSpringRepository(repoPath: string): Promise<SpringEndpoint[]> {
  const endpoints: SpringEndpoint[] = [];
  const basePackage = findBasePackage(repoPath);
  console.log('Base package:', basePackage);

  function scanDir(dir: string) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip common non-source directories
        if (!['build', 'target', 'node_modules', '.git'].includes(file)) {
          scanDir(filePath);
        }
      } else if (file.endsWith('.java')) {
        console.log('Scanning file:', file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Parse Spring annotations
        parseSpringFile(content, endpoints);

        // Look for Model/DTO classes
        if (file.endsWith('DTO.java') || file.endsWith('Model.java')) {
          parseModelClass(content);
        }
      }
    });
  }

  scanDir(repoPath);
  return endpoints;
}

function findBasePackage(repoPath: string): string {
  // Look for main application class with @SpringBootApplication
  let basePackage = '';

  function searchInDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        searchInDir(filePath);
      } else if (file.endsWith('.java')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('@SpringBootApplication')) {
          const packageMatch = content.match(/package\s+([\w.]+);/);
          if (packageMatch) {
            basePackage = packageMatch[1];
            return;
          }
        }
      }
    }
  }

  searchInDir(repoPath);
  return basePackage;
}

function parseSpringFile(content: string, endpoints: SpringEndpoint[]) {
  // Extract class-level RequestMapping
  let baseUrl = '';
  const classMapping = content.match(SPRING_ENDPOINT_PATTERNS.rest[2]);
  if (classMapping) {
    baseUrl = classMapping[1];
  }

  // Find REST endpoints
  SPRING_ENDPOINT_PATTERNS.rest.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[2]) { // Method-specific mapping
        endpoints.push({
          path: path.join(baseUrl, match[1]),
          method: match[2].toUpperCase(),
          type: 'REST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } else { // General RequestMapping
        ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => {
          endpoints.push({
            path: path.join(baseUrl, match[1]),
            method,
            type: 'REST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
        });
      }
    }
  });

  // Find SOAP endpoints
  let isSoapService = false;
  SPRING_ENDPOINT_PATTERNS.soap.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      isSoapService = true;
      if (match[1]) {
        endpoints.push({
          path: match[1],
          method: 'POST',
          type: 'SOAP',
          headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': match[1]
          }
        });
      }
    }
  });

  // If it's a SOAP service, parse request/response types
  if (isSoapService) {
    parseRequestResponseTypes(content, endpoints);
  }
}

function parseRequestResponseTypes(content: string, endpoints: SpringEndpoint[]) {
  SPRING_ENDPOINT_PATTERNS.requestBody.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const type = match[1];
      // Find the last endpoint added and update its request/response body
      const lastEndpoint = endpoints[endpoints.length - 1];
      if (lastEndpoint) {
        if (!lastEndpoint.requestBody) {
          lastEndpoint.requestBody = {
            type,
            fields: parseJavaClass(content, type)
          };
        } else if (!lastEndpoint.responseBody) {
          lastEndpoint.responseBody = {
            type,
            fields: parseJavaClass(content, type)
          };
        }
      }
    }
  });
}

function parseJavaClass(content: string, className: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const classPattern = new RegExp(`class\\s+${className}\\s*{([^}]*)}`, 'g');
  const fieldPattern = /private\s+(\w+(?:<.*?>)?)\s+(\w+);/g;

  const classMatch = classPattern.exec(content);
  if (classMatch) {
    const classBody = classMatch[1];
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(classBody)) !== null) {
      fields[fieldMatch[2]] = fieldMatch[1];
    }
  }

  return fields;
}

function parseModelClass(content: string) {
  // Extract class name
  const classMatch = content.match(/class\s+(\w+)/);
  if (!classMatch) return;

  const className = classMatch[1];
  const fields: Record<string, string> = {};

  // Find all fields
  const fieldPattern = /private\s+(\w+(?:<.*?>)?)\s+(\w+);/g;
  let fieldMatch;
  while ((fieldMatch = fieldPattern.exec(content)) !== null) {
    fields[fieldMatch[2]] = fieldMatch[1];
  }

  return {
    className,
    fields
  };
}

export default router;