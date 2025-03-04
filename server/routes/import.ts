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

// Enhanced patterns for Spring annotations
const SPRING_PATTERNS = {
  rest: {
    // Class level annotations
    classLevel: /@RestController|@Controller|@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,

    // Method level annotations
    methodLevel: [
      /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*,\s*method\s*=\s*RequestMethod\.(GET|POST|PUT|DELETE|PATCH)\)/g,
      /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    ],

    // Parameter annotations
    parameters: {
      path: /@PathVariable\s*\(\s*(?:value\s*=\s*)?["']?(\w+)["']?\s*\)\s*(\w+)\s+(\w+)/g,
      query: /@RequestParam\s*\(\s*(?:value\s*=\s*)?["']?(\w+)["']?\s*(?:,\s*required\s*=\s*(true|false))?\s*\)\s*(\w+)\s+(\w+)/g,
      header: /@RequestHeader\s*\(\s*(?:value\s*=\s*)?["']?(\w+)["']?\s*\)\s*(\w+)\s+(\w+)/g,
      body: /@RequestBody\s+(\w+(?:<.*?>)?)\s+(\w+)/g,
    },

    // Response annotations
    response: {
      status: /@ResponseStatus\s*\(\s*(?:value\s*=\s*)?HttpStatus\.(\w+)\s*\)/g,
      produces: /@Produces\s*\(\s*["']([^"']+)["']\s*\)/g,
      consumes: /@Consumes\s*\(\s*["']([^"']+)["']\s*\)/g,
    }
  },

  soap: {
    // SOAP annotations
    service: /@WebService\s*\(\s*(?:targetNamespace\s*=\s*)?["']([^"']+)["']\s*,?\s*(?:name\s*=\s*)?["']?([^"'\s,}]*)["']?\s*\)/g,
    operation: /@WebMethod\s*\(\s*operationName\s*=\s*["']([^"']+)["']\s*\)/g,
    binding: /@SOAPBinding\s*\(\s*style\s*=\s*Style\.(DOCUMENT|RPC)\s*,?\s*use\s*=\s*Use\.(LITERAL|ENCODED)\s*\)/g,
    parameter: /@WebParam\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)\s*(\w+)\s+(\w+)/g,
    result: /@WebResult\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)/g
  }
};

interface SpringParameter {
  name: string;
  type: string;
  required: boolean;
  in: 'path' | 'query' | 'header' | 'body';
}

interface SpringEndpoint {
  path: string;
  method: string;
  type: 'REST' | 'SOAP';
  parameters: SpringParameter[];
  requestBody?: {
    type: string;
    fields: Record<string, string>;
    required: boolean;
  };
  responseBody?: {
    type: string;
    fields: Record<string, string>;
  };
  headers: Record<string, string>;
  consumes: string[];
  produces: string[];
}

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
    const { endpoints, models } = await scanSpringRepository(repoDir);
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
      },
      models
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

async function scanSpringRepository(repoPath: string) {
  const endpoints: SpringEndpoint[] = [];
  const models: Record<string, Record<string, string>> = {};
  const basePackage = findBasePackage(repoPath);
  console.log('Base package:', basePackage);

  function scanDir(dir: string) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!['build', 'target', 'node_modules', '.git'].includes(file)) {
          scanDir(filePath);
        }
      } else if (file.endsWith('.java')) {
        console.log('Scanning file:', file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if it's a model/DTO class
        if (file.endsWith('DTO.java') || file.endsWith('Model.java') || content.includes('@Entity')) {
          const modelInfo = parseModelClass(content);
          if (modelInfo) {
            models[modelInfo.className] = modelInfo.fields;
          }
        }

        // Check for REST controller
        if (content.includes('@RestController') || content.includes('@Controller')) {
          parseRestController(content, endpoints, models);
        }

        // Check for SOAP endpoint
        if (content.includes('@WebService')) {
          parseSoapEndpoint(content, endpoints, models);
        }
      }
    });
  }

  scanDir(repoPath);
  return { endpoints, models };
}

function parseRestController(content: string, endpoints: SpringEndpoint[], models: Record<string, Record<string, string>>) {
  // Get base path from class level annotation
  let basePath = '';
  const classMatch = content.match(SPRING_PATTERNS.rest.classLevel);
  if (classMatch) {
    basePath = classMatch[1] || '';
  }

  // Find all method level mappings
  SPRING_PATTERNS.rest.methodLevel.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const endpoint: SpringEndpoint = {
        path: path.join(basePath, match[1] || ''),
        method: match[2]?.toUpperCase() || 'GET',
        type: 'REST',
        parameters: [],
        headers: {},
        consumes: [],
        produces: []
      };

      // Find method content
      const methodContent = extractMethodContent(content, match.index);

      // Parse parameters
      Object.entries(SPRING_PATTERNS.rest.parameters).forEach(([paramType, pattern]) => {
        let paramMatch;
        while ((paramMatch = pattern.exec(methodContent)) !== null) {
          const param: SpringParameter = {
            name: paramMatch[1],
            type: paramMatch[2],
            required: paramMatch.includes('required') ? paramMatch.includes('true') : true,
            in: paramType as 'path' | 'query' | 'header' | 'body'
          };
          endpoint.parameters.push(param);

          // If it's a body parameter, add request body schema
          if (paramType === 'body' && models[param.type]) {
            endpoint.requestBody = {
              type: param.type,
              fields: models[param.type],
              required: true
            };
          }
        }
      });

      // Parse response type
      const returnTypeMatch = methodContent.match(/public\s+(\w+(?:<.*?>)?)\s+\w+\s*\(/);
      if (returnTypeMatch && models[returnTypeMatch[1]]) {
        endpoint.responseBody = {
          type: returnTypeMatch[1],
          fields: models[returnTypeMatch[1]]
        };
      }

      // Parse produces/consumes
      const producesMatch = methodContent.match(SPRING_PATTERNS.rest.response.produces);
      if (producesMatch) {
        endpoint.produces = producesMatch[1].split(',').map(t => t.trim());
      }

      const consumesMatch = methodContent.match(SPRING_PATTERNS.rest.response.consumes);
      if (consumesMatch) {
        endpoint.consumes = consumesMatch[1].split(',').map(t => t.trim());
      }

      endpoints.push(endpoint);
    }
  });
}

function parseSoapEndpoint(content: string, endpoints: SpringEndpoint[], models: Record<string, Record<string, string>>) {
  // Find SOAP service details
  const serviceMatch = SPRING_PATTERNS.soap.service.exec(content);
  if (!serviceMatch) return;

  const namespace = serviceMatch[1];
  const serviceName = serviceMatch[2];

  // Find all SOAP operations
  let operationMatch;
  while ((operationMatch = SPRING_PATTERNS.soap.operation.exec(content)) !== null) {
    const endpoint: SpringEndpoint = {
      path: `${namespace}/${operationMatch[1]}`,
      method: 'POST',
      type: 'SOAP',
      parameters: [],
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': `${namespace}/${operationMatch[1]}`
      },
      consumes: ['text/xml'],
      produces: ['text/xml']
    };

    // Get method content
    const methodContent = extractMethodContent(content, operationMatch.index);

    // Parse parameters
    let paramMatch;
    while ((paramMatch = SPRING_PATTERNS.soap.parameter.exec(methodContent)) !== null) {
      const paramName = paramMatch[1];
      const paramType = paramMatch[2];

      endpoint.parameters.push({
        name: paramName,
        type: paramType,
        required: true,
        in: 'body'
      });

      // If parameter type exists in models, use it for request body
      if (models[paramType]) {
        endpoint.requestBody = {
          type: paramType,
          fields: models[paramType],
          required: true
        };
      }
    }

    // Parse return type
    const resultMatch = SPRING_PATTERNS.soap.result.exec(methodContent);
    if (resultMatch) {
      const returnType = resultMatch[1];
      if (models[returnType]) {
        endpoint.responseBody = {
          type: returnType,
          fields: models[returnType]
        };
      }
    }

    endpoints.push(endpoint);
  }
}

function extractMethodContent(content: string, startIndex: number): string {
  let braceCount = 0;
  let methodContent = '';
  let i = startIndex;

  // Find method start
  while (i < content.length) {
    if (content[i] === '{') {
      braceCount++;
      break;
    }
    i++;
  }

  // Extract method body
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    methodContent += content[i];
    i++;
  }

  return methodContent;
}

function findBasePackage(repoPath: string): string {
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

function parseModelClass(content: string) {
  // Extract class name
  const classMatch = content.match(/class\s+(\w+)/);
  if (!classMatch) return null;

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