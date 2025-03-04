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
    // Class level annotations with base path capture
    classLevel: {
      controller: /@(?:Rest)?Controller(?:\s*\([^)]*\))?\s*(?:class|interface)\s+(\w+)/g,
      requestMapping: /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g
    },

    // Method level annotations with path and parameters
    methodLevel: {
      request: /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*,\s*method\s*=\s*RequestMethod\.(GET|POST|PUT|DELETE|PATCH)\)/g,
      get: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,
      post: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,
      put: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,
      delete: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g,
      patch: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/g
    },

    // Parameter annotations with type info
    parameters: {
      pathVar: /@PathVariable\s*\(\s*(?:name\s*=\s*)?["']?(\w+)["']?\s*(?:,\s*required\s*=\s*(true|false))?\s*\)\s*(\w+(?:<[^>]+>)?)\s+(\w+)/g,
      requestParam: /@RequestParam\s*\(\s*(?:value\s*=\s*)?["']?(\w+)["']?\s*(?:,\s*required\s*=\s*(true|false))?\s*\)\s*(\w+(?:<[^>]+>)?)\s+(\w+)/g,
      requestHeader: /@RequestHeader\s*\(\s*(?:value\s*=\s*)?["']?(\w+)["']?\s*(?:,\s*required\s*=\s*(true|false))?\s*\)\s*(\w+(?:<[^>]+>)?)\s+(\w+)/g,
      requestBody: /@RequestBody\s*(?:\(\s*required\s*=\s*(true|false)\s*\))?\s*(\w+(?:<[^>]+>)?)\s+(\w+)/g
    },

    // Method metadata
    metadata: {
      produces: /@Produces\s*\(\s*["']([^"']+)["']\s*\)/g,
      consumes: /@Consumes\s*\(\s*["']([^"']+)["']\s*\)/g,
      responseStatus: /@ResponseStatus\s*\(\s*(?:value\s*=\s*)?HttpStatus\.(\w+)\s*\)/g
    }
  },

  soap: {
    // SOAP service definitions
    service: {
      webService: /@WebService\s*\(\s*(?:targetNamespace\s*=\s*)?["']([^"']+)["']\s*(?:,\s*name\s*=\s*["']([^"']+)["'])?\s*\)/g,
      portType: /@SOAPBinding\s*\(\s*style\s*=\s*Style\.(DOCUMENT|RPC)\s*,\s*use\s*=\s*Use\.(LITERAL|ENCODED)\s*\)/g
    },

    // Operation definitions
    operation: {
      webMethod: /@WebMethod\s*\(\s*operationName\s*=\s*["']([^"']+)["']\s*\)/g,
      requestWrapper: /@RequestWrapper\s*\(\s*targetNamespace\s*=\s*["']([^"']+)["']\s*,\s*localName\s*=\s*["']([^"']+)["']\s*,\s*className\s*=\s*([^.]+)\.class\s*\)/g,
      responseWrapper: /@ResponseWrapper\s*\(\s*targetNamespace\s*=\s*["']([^"']+)["']\s*,\s*localName\s*=\s*["']([^"']+)["']\s*,\s*className\s*=\s*([^.]+)\.class\s*\)/g
    },

    // Parameter definitions
    parameters: {
      webParam: /@WebParam\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)\s*(\w+(?:<[^>]+>)?)\s+(\w+)/g,
      webResult: /@WebResult\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)\s*(\w+(?:<[^>]+>)?)/g
    }
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
  console.log('Starting Spring repository scan...');
  const endpoints: any[] = [];
  const models: Record<string, any> = {};

  function scanDir(dir: string) {
    console.log(`Scanning directory: ${dir}`);
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!['build', 'target', 'node_modules', '.git'].includes(file)) {
          scanDir(filePath);
        }
      } else if (file.endsWith('.java')) {
        console.log(`Processing Java file: ${file}`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Process REST Controllers
        if (content.includes('@RestController') || content.includes('@Controller')) {
          console.log(`Found REST controller in ${file}`);
          const endpoints = parseRestController(content);
          console.log(`Extracted ${endpoints.length} REST endpoints`);
          endpoints.push(...endpoints);
        }

        // Process SOAP Services
        if (content.includes('@WebService')) {
          console.log(`Found SOAP service in ${file}`);
          const soapEndpoints = parseSoapService(content);
          console.log(`Extracted ${soapEndpoints.length} SOAP endpoints`);
          endpoints.push(...soapEndpoints);
        }

        // Process DTOs and Models
        if (file.endsWith('DTO.java') || file.endsWith('Model.java') || content.includes('@Entity')) {
          console.log(`Found model class in ${file}`);
          const model = parseModelClass(content);
          if (model) {
            console.log(`Extracted model: ${model.className}`);
            models[model.className] = model.fields;
          }
        }
      }
    }
  }

  scanDir(repoPath);
  return { endpoints, models };
}

function parseRestController(content: string) {
  const endpoints = [];
  let basePath = '';

  // Get controller class name and base path
  const classMatches = content.match(SPRING_PATTERNS.rest.classLevel.controller);
  const basePathMatches = content.match(SPRING_PATTERNS.rest.classLevel.requestMapping);

  if (basePathMatches) {
    basePath = basePathMatches[1] || '';
  }

  // Extract all method-level mappings
  Object.entries(SPRING_PATTERNS.rest.methodLevel).forEach(([method, pattern]) => {
    let match;
    while ((match = pattern.exec(content))) {
      const methodContent = extractMethodContent(content, match.index);
      if (!methodContent) continue;

      const endpoint = {
        type: 'REST',
        path: path.join(basePath, match[1] || ''),
        method: method === 'request' ? match[2] : method.toUpperCase(),
        parameters: extractParameters(methodContent),
        requestBody: extractRequestBody(methodContent),
        responseBody: extractResponseBody(methodContent),
        headers: {},
        produces: extractContentTypes(methodContent, 'produces'),
        consumes: extractContentTypes(methodContent, 'consumes')
      };

      console.log(`Found REST endpoint: ${endpoint.method} ${endpoint.path}`);
      endpoints.push(endpoint);
    }
  });

  return endpoints;
}

function parseSoapService(content: string) {
  const endpoints = [];
  let namespace = '';
  let serviceName = '';

  // Get SOAP service details
  const serviceMatch = SPRING_PATTERNS.soap.service.webService.exec(content);
  if (serviceMatch) {
    namespace = serviceMatch[1];
    serviceName = serviceMatch[2] || '';
  }

  // Extract all web methods
  let match;
  while ((match = SPRING_PATTERNS.soap.operation.webMethod.exec(content))) {
    const methodContent = extractMethodContent(content, match.index);
    if (!methodContent) continue;

    const operationName = match[1];
    const endpoint = {
      type: 'SOAP',
      path: `${namespace}/${operationName}`,
      method: 'POST',
      parameters: extractSoapParameters(methodContent),
      requestBody: extractSoapRequestWrapper(methodContent),
      responseBody: extractSoapResponseWrapper(methodContent),
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': `${namespace}/${operationName}`
      }
    };

    console.log(`Found SOAP endpoint: ${endpoint.path}`);
    endpoints.push(endpoint);
  }

  return endpoints;
}

function extractMethodContent(content: string, startIndex: number): string | null {
  let openBraces = 0;
  let methodContent = '';
  let i = startIndex;

  // Find method start
  while (i < content.length) {
    if (content[i] === '{') {
      openBraces++;
      break;
    }
    i++;
  }

  if (openBraces === 0) return null;

  // Extract method body
  while (i < content.length) {
    methodContent += content[i];
    if (content[i] === '{') openBraces++;
    if (content[i] === '}') {
      openBraces--;
      if (openBraces === 0) break;
    }
    i++;
  }

  return methodContent;
}

function parseModelClass(content: string) {
  const classMatch = content.match(/class\s+(\w+)/);
  if (!classMatch) return null;

  const className = classMatch[1];
  const fields: Record<string, any> = {};

  // Extract fields with their types
  const fieldPattern = /private\s+(\w+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
  let fieldMatch;

  while ((fieldMatch = fieldPattern.exec(content))) {
    const [, type, name] = fieldMatch;
    fields[name] = {
      type,
      required: !content.includes(`@Nullable`) && !content.includes(`Optional<${type}>`)
    };
  }

  return { className, fields };
}

function extractParameters(methodContent: string) {
  const parameters = [];

  // Extract path variables
  Object.entries(SPRING_PATTERNS.rest.parameters).forEach(([paramType, pattern]) => {
    let match;
    while ((match = pattern.exec(methodContent))) {
      parameters.push({
        name: match[1],
        type: match[3] || match[2], // Handle different pattern groups
        in: paramType === 'pathVar' ? 'path' : 
            paramType === 'requestParam' ? 'query' : 
            paramType === 'requestHeader' ? 'header' : 'body',
        required: match.includes('required') ? match.includes('true') : true
      });
    }
  });

  return parameters;
}

function extractContentTypes(methodContent: string, type: 'produces' | 'consumes') {
  const pattern = SPRING_PATTERNS.rest.metadata[type];
  const matches = methodContent.match(pattern);
  return matches ? matches[1].split(',').map(t => t.trim()) : [];
}

function extractSoapParameters(methodContent: string) {
  const parameters = [];
  let match;

  while ((match = SPRING_PATTERNS.soap.parameters.webParam.exec(methodContent))) {
    parameters.push({
      name: match[1],
      type: match[2],
      required: true // SOAP parameters are typically required
    });
  }

  return parameters;
}

function extractSoapRequestWrapper(methodContent: string) {
  const match = SPRING_PATTERNS.soap.operation.requestWrapper.exec(methodContent);
  return match ? {
    namespace: match[1],
    localName: match[2],
    className: match[3]
  } : null;
}

function extractSoapResponseWrapper(methodContent: string) {
  const match = SPRING_PATTERNS.soap.operation.responseWrapper.exec(methodContent);
  return match ? {
    namespace: match[1],
    localName: match[2],
    className: match[3]
  } : null;
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

function extractRequestBody(methodContent: string) {
    const match = SPRING_PATTERNS.rest.parameters.requestBody.exec(methodContent);
    if (match) {
        return {
            type: match[1],
            required: match[2] === 'true'
        };
    }
    return null;
}

function extractResponseBody(methodContent: string) {
    const returnTypeMatch = methodContent.match(/public\s+(\w+(?:<.*?>)?)\s+\w+\s*\(/);
    return returnTypeMatch ? { type: returnTypeMatch[1] } : null;
}


export default router;