import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import crypto from 'crypto';
import axios from 'axios';
import { Request, RequestSchema } from '@shared/schema';
import { createLogger } from '../utils/logger';

const TEMP_DIR = path.join(process.cwd(), 'server', 'temp');
const API_FOLDER = path.join(process.cwd(), 'client', 'api');
const logger = createLogger('ApiDefinitionService');

export interface ApiEnvironments {
  dev?: string;
  qa01?: string;
  qa02?: string;
  qa03?: string;
  perf?: string;
}

export class ApiDefinitionService {
  /**
   * Ensures necessary directories exist
   */
  private static async ensureDirectories() {
    logger.debug('Ensuring necessary directories exist');
    
    // Ensure temp directory exists
    try {
      await fs.access(TEMP_DIR);
      logger.debug(`Temp directory exists at ${TEMP_DIR}`);
    } catch {
      logger.info(`Creating temp directory at ${TEMP_DIR}`);
      await fs.mkdir(TEMP_DIR, { recursive: true });
    }

    // Ensure API folder exists
    try {
      await fs.access(API_FOLDER);
      logger.debug(`API folder exists at ${API_FOLDER}`);
    } catch {
      logger.info(`Creating API folder at ${API_FOLDER}`);
      await fs.mkdir(API_FOLDER, { recursive: true });
    }
  }

  /**
   * Clones a GitHub repository to a temporary directory
   */
  private static async cloneRepository(
    githubUrl: string,
    username: string,
    password: string
  ): Promise<string> {
    logger.info(`Cloning repository from ${githubUrl}`);
    await this.ensureDirectories();

    // Create a unique directory for this import
    const importId = crypto.randomUUID();
    const repoDir = path.join(TEMP_DIR, importId);
    logger.debug(`Using temporary directory: ${repoDir}`);

    // Clean up existing directory if it exists
    if (fsSync.existsSync(repoDir)) {
      logger.debug(`Cleaning up existing directory: ${repoDir}`);
      fsSync.rmSync(repoDir, { recursive: true, force: true });
    }

    try {
      // Format git URL for authentication
      const gitUrl = githubUrl.replace('https://', '');
      const gitCommand = `git clone https://${username}:${password}@${gitUrl} ${repoDir}`;
      
      logger.info('Executing git clone command');
      // Execute git clone command
      execSync(gitCommand);
      
      logger.info(`Repository cloned successfully to ${repoDir}`);
      return repoDir;
    } catch (error) {
      logger.error('Error cloning repository', error);
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  /**
   * Identifies API type (REST/SOAP) by searching for relevant files
   */
  private static async identifyApiType(repoDir: string): Promise<{ 
    type: 'REST' | 'SOAP' | 'UNKNOWN',
    mainFilePath: string | null
  }> {
    logger.info(`Identifying API type in repository: ${repoDir}`);
    try {
      // Get all files recursively
      const getAllFiles = async (dir: string): Promise<string[]> => {
        const files = await fs.readdir(dir, { withFileTypes: true });
        const paths = await Promise.all(files.map(async (file) => {
          const filePath = path.join(dir, file.name);
          return file.isDirectory() ? getAllFiles(filePath) : filePath;
        }));
        return paths.flat();
      };

      logger.debug('Scanning repository files');
      const allFiles = await getAllFiles(repoDir);
      logger.debug(`Found ${allFiles.length} files in the repository`);

      // Look for OpenAPI files
      logger.debug('Searching for OpenAPI files');
      const openApiFiles = allFiles.filter(file => {
        const fileName = path.basename(file).toLowerCase();
        const ext = path.extname(file).toLowerCase();
        return (
          fileName === 'swagger.json' || 
          fileName === 'swagger.yaml' || 
          fileName === 'swagger.yml' ||
          fileName === 'openapi.json' || 
          fileName === 'openapi.yaml' || 
          fileName === 'openapi.yml' ||
          (ext === '.json' || ext === '.yaml' || ext === '.yml') && 
          fsSync.readFileSync(file, 'utf8').includes('"openapi"') ||
          fsSync.readFileSync(file, 'utf8').includes('openapi:')
        );
      });
      logger.debug(`Found ${openApiFiles.length} OpenAPI files`);

      // Look for WSDL files
      logger.debug('Searching for WSDL files');
      const wsdlFiles = allFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.wsdl' || ext === '.xsd';
      });
      logger.debug(`Found ${wsdlFiles.length} WSDL/XSD files`);

      if (openApiFiles.length > 0) {
        // Find main OpenAPI file (prefer root-level files)
        const rootOpenApiFiles = openApiFiles.filter(file => {
          const relativePath = path.relative(repoDir, file);
          return !relativePath.includes(path.sep) || relativePath.split(path.sep).length <= 2;
        });

        const mainFilePath = rootOpenApiFiles.length > 0 ? rootOpenApiFiles[0] : openApiFiles[0];
        logger.info(`Identified as REST API with main file: ${mainFilePath}`);
        return { type: 'REST', mainFilePath };
      }

      if (wsdlFiles.length > 0) {
        // Find main WSDL file (look for .wsdl files, not .xsd)
        const wsdlOnlyFiles = wsdlFiles.filter(file => path.extname(file).toLowerCase() === '.wsdl');
        const mainFilePath = wsdlOnlyFiles.length > 0 ? wsdlOnlyFiles[0] : wsdlFiles[0];
        logger.info(`Identified as SOAP API with main file: ${mainFilePath}`);
        return { type: 'SOAP', mainFilePath };
      }

      logger.warn('Could not identify API type, no OpenAPI or WSDL files found');
      return { type: 'UNKNOWN', mainFilePath: null };
    } catch (error) {
      logger.error('Error identifying API type', error);
      return { type: 'UNKNOWN', mainFilePath: null };
    }
  }

  /**
   * Resolves and merges external schemas for OpenAPI
   */
  private static async resolveOpenApiReferences(filePath: string, repoDir: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      let apiSpec: any;

      // Parse the file based on extension
      if (filePath.endsWith('.json')) {
        apiSpec = JSON.parse(content);
      } else {
        apiSpec = yaml.load(content);
      }

      // Handle $ref references that point to external files
      const processRefs = async (obj: any, currentPath: string): Promise<any> => {
        if (!obj || typeof obj !== 'object') return obj;

        // Process arrays
        if (Array.isArray(obj)) {
          return Promise.all(obj.map(item => processRefs(item, currentPath)));
        }

        // Create a new object to modify
        const newObj: any = {};

        // Process each property
        for (const [key, value] of Object.entries(obj)) {
          if (key === '$ref' && typeof value === 'string' && value.startsWith('#/')) {
            // Internal reference, keep as is
            newObj[key] = value;
          } else if (key === '$ref' && typeof value === 'string' && !value.startsWith('http')) {
            // External file reference
            try {
              // Resolve the file path
              let refFilePath: string;
              if (value.includes('#')) {
                // Format: 'file.json#/components/schemas/Model'
                const [filePart, refPart] = value.split('#');
                refFilePath = path.resolve(path.dirname(currentPath), filePart);

                // Read and parse the referenced file
                const refContent = await fs.readFile(refFilePath, 'utf8');
                let refObj: any;

                if (refFilePath.endsWith('.json')) {
                  refObj = JSON.parse(refContent);
                } else {
                  refObj = yaml.load(refContent);
                }

                // Navigate to the referenced part
                let refValue = refObj;
                const refPath = refPart.split('/').filter(Boolean);
                for (const segment of refPath) {
                  refValue = refValue[segment];
                  if (!refValue) break;
                }

                // Replace the reference with the actual content
                if (refValue) {
                  // Process nested references
                  return await processRefs(refValue, refFilePath);
                } else {
                  // Keep the original reference if we couldn't resolve it
                  newObj[key] = value;
                }
              } else {
                // Format: 'file.json' (reference to whole file)
                refFilePath = path.resolve(path.dirname(currentPath), value);
                const refContent = await fs.readFile(refFilePath, 'utf8');
                let refObj: any;

                if (refFilePath.endsWith('.json')) {
                  refObj = JSON.parse(refContent);
                } else {
                  refObj = yaml.load(refContent);
                }

                // Process the whole referenced object
                return await processRefs(refObj, refFilePath);
              }
            } catch (error) {
              console.warn(`Failed to resolve reference: ${value}`, error);
              newObj[key] = value; // Keep the original reference if resolution fails
            }
          } else if (typeof value === 'object' && value !== null) {
            // Process nested objects
            newObj[key] = await processRefs(value, currentPath);
          } else {
            // Pass through primitive values
            newObj[key] = value;
          }
        }

        return newObj;
      };

      // Process the entire spec
      return await processRefs(apiSpec, filePath);
    } catch (error) {
      console.error('Error resolving OpenAPI references:', error);
      throw error;
    }
  }

  /**
   * Merges XSD definitions for WSDL files
   */
  private static async resolveWsdlReferences(filePath: string, repoDir: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Extract all xsd:import and xsd:include tags
      const importRegex = /<(?:xsd:|wsdl:)?import\s+[^>]*(?:schemaLocation|location)=["']([^"']+)["'][^>]*>/g;
      const includeRegex = /<(?:xsd:|wsdl:)?include\s+[^>]*(?:schemaLocation|location)=["']([^"']+)["'][^>]*>/g;

      // Find all imports and includes
      let match;
      const imports = [];
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      const includes = [];
      while ((match = includeRegex.exec(content)) !== null) {
        includes.push(match[1]);
      }

      // Resolve all referenced files
      let mergedContent = content;
      const processedFiles = new Set<string>();
      processedFiles.add(filePath);

      const processReference = async (reference: string): Promise<string> => {
        try {
          // Resolve the reference path
          const refPath = path.resolve(path.dirname(filePath), reference);

          // Skip if already processed
          if (processedFiles.has(refPath)) return '';
          processedFiles.add(refPath);

          // Read the referenced file
          const refContent = await fs.readFile(refPath, 'utf8');

          // Process nested references
          let processedContent = refContent;

          // Extract nested imports and includes
          const nestedImports = [];
          while ((match = importRegex.exec(refContent)) !== null) {
            nestedImports.push(match[1]);
          }

          const nestedIncludes = [];
          while ((match = includeRegex.exec(refContent)) !== null) {
            nestedIncludes.push(match[1]);
          }

          // Process nested references
          for (const nestedRef of [...nestedImports, ...nestedIncludes]) {
            const nestedContent = await processReference(nestedRef);
            // Replace import/include tags with the content
            processedContent = processedContent.replace(
              new RegExp(`<(?:xsd:|wsdl:)?(?:import|include)\\s+[^>]*(?:schemaLocation|location)=["']${nestedRef}["'][^>]*>`, 'g'),
              nestedContent
            );
          }

          return processedContent;
        } catch (error) {
          console.warn(`Failed to resolve reference: ${reference}`, error);
          return ''; // Return empty string if resolution fails
        }
      };

      // Process all references
      for (const ref of [...imports, ...includes]) {
        const refContent = await processReference(ref);
        // Replace import/include tags with the content
        mergedContent = mergedContent.replace(
          new RegExp(`<(?:xsd:|wsdl:)?(?:import|include)\\s+[^>]*(?:schemaLocation|location)=["']${ref}["'][^>]*>`, 'g'),
          refContent
        );
      }

      return mergedContent;
    } catch (error) {
      console.error('Error resolving WSDL references:', error);
      throw error;
    }
  }

  /**
   * Extracts requests from resolved OpenAPI definition
   */
  private static extractOpenApiRequests(apiSpec: any, environments: ApiEnvironments): Request[] {
    try {
      const requests: Request[] = [];

      logger.info(`Extracting requests from OpenAPI definition`);
      logger.debug(`API Spec structure: ${JSON.stringify(Object.keys(apiSpec))}`);
      
      if (!apiSpec.paths) {
        logger.warn(`No paths found in OpenAPI spec`);
        return requests;
      }
      
      logger.debug(`Found ${Object.keys(apiSpec.paths).length} paths in OpenAPI spec`);
      
      const specTitle = apiSpec.info?.title || 'Imported API';
      const specVersion = apiSpec.info?.version || '1.0.0';
      
      logger.info(`API Title: ${specTitle}, Version: ${specVersion}`);

      // Process each path and method
      Object.entries(apiSpec.paths).forEach(([path, pathItem]: [string, any]) => {
        // Skip if pathItem is not an object
        if (!pathItem || typeof pathItem !== 'object') {
          return;
        }

        // Find all HTTP methods in this path
        const methods = Object.keys(pathItem).filter(key => 
          ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(key.toLowerCase())
        );

        // Process each method
        methods.forEach(method => {
          const operation = pathItem[method];
          if (!operation) return;

          // Generate a unique ID for this request
          const timestamp = new Date().getTime();
          const requestId = `${method.toLowerCase()}-${path.replace(/[^\w-]/g, '-')}-${timestamp}`;

          // Extract path parameters
          const pathParams: Record<string, string> = {};
          const pathParamMatches = path.match(/\{([^}]+)\}/g) || [];
          pathParamMatches.forEach(match => {
            const paramName = match.substring(1, match.length - 1);
            pathParams[paramName] = '';
          });

          // Extract query parameters
          const queryParams: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === 'query') {
                queryParams[param.name] = param.example || '';
              }
            });
          }

          // Extract headers
          const headers: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === 'header') {
                // Use example if available, otherwise use default, schema.example, or schema.default
                headers[param.name] = param.example || 
                                    param.default || 
                                    (param.schema?.example) || 
                                    (param.schema?.default) || 
                                    ApiDefinitionService.generateHeaderValue(param);
              }
            });
          }
          
          // Extract global headers
          if (apiSpec.components?.securitySchemes) {
            Object.entries(apiSpec.components.securitySchemes).forEach(([key, scheme]: [string, any]) => {
              if (scheme.type === 'apiKey' && scheme.in === 'header') {
                headers[scheme.name] = `{${key}_value}`;
              }
            });
          }

          // Add Content-Type header if not present but requestBody exists
          if (operation.requestBody && !headers['Content-Type']) {
            const contentTypes = operation.requestBody.content ? Object.keys(operation.requestBody.content) : [];
            if (contentTypes.includes('application/json')) {
              headers['Content-Type'] = 'application/json';
            } else if (contentTypes.length > 0) {
              headers['Content-Type'] = contentTypes[0];
            }
          }

          // Extract request body
          let requestBody: any = {};
          if (operation.requestBody?.content) {
            const contentTypes = Object.keys(operation.requestBody.content);
            if (contentTypes.length > 0) {
              // Prefer JSON content type if available
              const contentType = contentTypes.find(ct => ct.includes('json')) || contentTypes[0];
              const content = operation.requestBody.content[contentType];

              if (content.example) {
                requestBody = content.example;
              } else if (content.examples && Object.keys(content.examples).length > 0) {
                // Use the first example if multiple are provided
                const firstExampleKey = Object.keys(content.examples)[0];
                requestBody = content.examples[firstExampleKey].value;
              } else if (content.schema) {
                // Generate sample from schema
                requestBody = this.generateSampleFromSchema(content.schema, apiSpec);
              }
            }
          }

          // Extract response body
          let responseBody: any = {};
          if (operation.responses) {
            // Look for 200, 201, or the first response
            const successCodes = ['200', '201', '202', '204'];
            let successResponse = null;

            // Find first available success response
            for (const code of successCodes) {
              if (operation.responses[code]) {
                successResponse = operation.responses[code];
                break;
              }
            }

            // If no success response found, use the first one
            if (!successResponse && Object.keys(operation.responses).length > 0) {
              const firstKey = Object.keys(operation.responses)[0];
              successResponse = operation.responses[firstKey];
            }

            if (successResponse?.content) {
              const contentTypes = Object.keys(successResponse.content);
              if (contentTypes.length > 0) {
                // Prefer JSON content type if available
                const contentType = contentTypes.find(ct => ct.includes('json')) || contentTypes[0];
                const content = successResponse.content[contentType];

                if (content.example) {
                  responseBody = content.example;
                } else if (content.examples && Object.keys(content.examples).length > 0) {
                  // Use the first example if multiple are provided
                  const firstExampleKey = Object.keys(content.examples)[0];
                  responseBody = content.examples[firstExampleKey].value;
                } else if (content.schema) {
                  // Generate sample from schema
                  responseBody = this.generateSampleFromSchema(content.schema, apiSpec);
                }
              }
            }
          }

          // Create a request object
          const request: Request = {
            requestId,
            routeId: requestId,
            name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            baseUrl: path,
            pathVariables: pathParams,
            queryParams,
            headers,
            auth: { type: "bearer-tiaa" }, // Default to bearer-tiaa
            requestBody,
            responseFields: {},
            exampleResponseBody: responseBody,
            historyId: `history-${requestId}`,
            historyRequests: [],
            devUrl: environments.dev || '',
            qa01Url: environments.qa01 || '',
            qa02Url: environments.qa02 || '',
            qa03Url: environments.qa03 || '',
            perfUrl: environments.perf || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            selectedEnvironment: "qa01",
            tags: operation.tags || [],
            collectionId: specTitle.replace(/[^\w-]/g, '-'),
            collectionName: specTitle
          };

          requests.push(request);
        });
      });

      return requests;
    } catch (error) {
      console.error('Error extracting OpenAPI requests:', error);
      return [];
    }
  }

  /**
   * Extracts requests from resolved WSDL definition
   */
  private static extractWsdlRequests(wsdlContent: string, environments: ApiEnvironments): Request[] {
    try {
      const requests: Request[] = [];

      // Extract service name
      const serviceNameMatch = wsdlContent.match(/<wsdl:service\s+name="([^"]+)"/);
      const serviceName = serviceNameMatch ? serviceNameMatch[1] : 'ImportedService';

      // Extract operations
      const operationRegex = /<wsdl:operation\s+name="([^"]+)"/g;
      let operationMatch;
      const operations = [];

      while ((operationMatch = operationRegex.exec(wsdlContent)) !== null) {
        operations.push(operationMatch[1]);
      }

      // For each operation, create a request
      operations.forEach(operation => {
        const timestamp = new Date().getTime();
        const requestId = `soap-${operation.toLowerCase()}-${timestamp}`;

        // Extract input message for this operation
        const inputMessageRegex = new RegExp(`<wsdl:operation\\s+name="${operation}"[^>]*>\\s*<wsdl:input\\s+(?:name="([^"]*)"\\s+)?message="(?:[^:]+:)?([^"]+)"`, 'm');
        const inputMessageMatch = wsdlContent.match(inputMessageRegex);
        const inputMessageName = inputMessageMatch ? inputMessageMatch[2] : `${operation}Input`;

        // Extract message structure
        const messageRegex = new RegExp(`<wsdl:message\\s+name="${inputMessageName}"[^>]*>(.*?)</wsdl:message>`, 's');
        const messageMatch = wsdlContent.match(messageRegex);

        // Create a simple SOAP envelope
        let requestBody = {
          "soap:Envelope": {
            "@xmlns:soap": "http://www.w3.org/2003/05/soap-envelope",
            "@xmlns:tem": "http://tempuri.org/",
            "soap:Header": {},
            "soap:Body": {
              [`tem:${operation}`]: {}
            }
          }
        };

        // If we found message parts, add them to the request
        if (messageMatch) {
          const partRegex = /<wsdl:part\s+name="([^"]+)"\s+element="(?:[^:]+:)?([^"]+)"/g;
          let partMatch;

          while ((partMatch = partRegex.exec(messageMatch[1])) !== null) {
            const partName = partMatch[2];
            if (requestBody["soap:Envelope"] && 
               requestBody["soap:Envelope"]["soap:Body"] && 
               requestBody["soap:Envelope"]["soap:Body"][`tem:${operation}`]) {
              requestBody["soap:Envelope"]["soap:Body"][`tem:${operation}`][partName] = "";
            }
          }
        }

        // Create a request object
        const request: Request = {
          requestId,
          routeId: requestId,
          name: operation,
          method: "POST", // SOAP uses POST
          baseUrl: "/", // Will be replaced with actual endpoint when running
          pathVariables: {},
          queryParams: {},
          headers: {
            "Content-Type": "application/soap+xml; charset=utf-8",
            "SOAPAction": `http://tempuri.org/${operation}`
          },
          auth: { type: "bearer-tiaa" },
          requestBody,
          responseFields: {},
          exampleResponseBody: { 
            "soap:Envelope": { 
              "soap:Body": { 
                [`${operation}Response`]: {} 
              } 
            } 
          },
          historyId: `history-${requestId}`,
          historyRequests: [],
          devUrl: environments.dev || '',
          qa01Url: environments.qa01 || '',
          qa02Url: environments.qa02 || '',
          qa03Url: environments.qa03 || '',
          perfUrl: environments.perf || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          selectedEnvironment: "qa01",
          tags: ['SOAP', serviceName],
          collectionId: serviceName.replace(/[^\w-]/g, '-'),
          collectionName: serviceName
        };

        requests.push(request);
      });

      return requests;
    } catch (error) {
      console.error('Error extracting WSDL requests:', error);
      return [];
    }
  }

  /**
   * Helper method to generate a sample from an OpenAPI schema
   */
  private static generateSampleFromSchema(schema: any, fullSpec: any): any {
    if (!schema) return {};

    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/', '').split('/');
      let refObj = fullSpec;
      for (const segment of refPath) {
        refObj = refObj?.[segment];
        if (!refObj) return {};
      }
      return this.generateSampleFromSchema(refObj, fullSpec);
    }

    // Handle allOf, oneOf, anyOf
    if (schema.allOf) {
      const result: any = {};
      schema.allOf.forEach((subSchema: any) => {
        const sample = this.generateSampleFromSchema(subSchema, fullSpec);
        Object.assign(result, sample);
      });
      return result;
    }

    if (schema.oneOf || schema.anyOf) {
      const subSchemas = schema.oneOf || schema.anyOf;
      if (subSchemas.length > 0) {
        return this.generateSampleFromSchema(subSchemas[0], fullSpec);
      }
      return {};
    }

    // Use example if provided
    if (schema.example !== undefined) {
      return schema.example;
    }

    // Handle type
    switch (schema.type) {
      case 'object':
        const result: any = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
            // Use property example if available
            if ((propSchema as any).example !== undefined) {
              result[propName] = (propSchema as any).example;
            } else {
              result[propName] = this.generateSampleFromSchema(propSchema, fullSpec);
            }
          });
        }
        // Add required fields that might be missing
        if (schema.required && Array.isArray(schema.required)) {
          schema.required.forEach((reqField: string) => {
            if (result[reqField] === undefined) {
              result[reqField] = 'required-value';
            }
          });
        }
        return result;

      case 'array':
        if (schema.items) {
          return [this.generateSampleFromSchema(schema.items, fullSpec)];
        }
        return [];

      case 'string':
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0];
        }
        if (schema.format === 'date-time') {
          return new Date().toISOString();
        }
        if (schema.format === 'date') {
          return new Date().toISOString().split('T')[0];
        }
        if (schema.format === 'uuid') {
          return '00000000-0000-0000-0000-000000000000';
        }
        if (schema.format === 'email') {
          return 'user@example.com';
        }
        if (schema.format === 'uri' || schema.format === 'url') {
          return 'https://example.com';
        }
        return 'string';

      case 'number':
      case 'integer':
        return schema.format === 'int64' ? 1000000000 : 0;

      case 'boolean':
        return false;

      default:
        // For YAML files that might not specify type properly
        if (schema.properties) {
          const result: any = {};
          Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
            result[propName] = this.generateSampleFromSchema(propSchema, fullSpec);
          });
          return result;
        }
        return {};
    }
  }

  /**
   * Creates requests in the API system
   */
  private static async createRequests(requests: Request[]): Promise<{ success: number, failure: number, updated: number }> {
    logger.info(`Creating ${requests.length} API requests`);
    let success = 0;
    let failure = 0;
    let updated = 0;

    // Ensure API folder exists
    await this.ensureApiFolder();

    // Save each request to a file
    for (const request of requests) {
      try {
        logger.debug(`Processing request: ${request.name} (${request.method} ${request.baseUrl})`);
        
        // Set default auth to bearer-tiaa if not specified
        if (!request.auth || request.auth.type === 'none') {
          logger.debug('Setting default auth type to bearer-tiaa');
          request.auth = { type: "bearer-tiaa" };
        }

        // Validate request with schema
        logger.debug('Validating request against schema');
        const validatedRequest = RequestSchema.parse(request);

        // Check for duplicates by matching path and method
        logger.debug('Checking for duplicate requests');
        const apiFiles = await fs.readdir(API_FOLDER);
        const existingFiles = apiFiles.filter(file => file.endsWith('.json'));
        logger.debug(`Found ${existingFiles.length} existing API files`);

        let isDuplicate = false;

        for (const file of existingFiles) {
          try {
            const content = await fs.readFile(path.join(API_FOLDER, file), 'utf-8');
            const existingRequest = JSON.parse(content);

            // Compare based on path and method to find duplicates
            if (existingRequest.method === request.method && 
                existingRequest.baseUrl === request.baseUrl && 
                existingRequest.name === request.name) {
              
              logger.info(`Found duplicate request: ${existingRequest.name} (${existingRequest.method} ${existingRequest.baseUrl})`);
              
              // Update the existing request but keep its ID
              const mergedRequest = {
                ...validatedRequest,
                requestId: existingRequest.requestId,
                routeId: existingRequest.routeId,
                historyId: existingRequest.historyId,
                historyRequests: existingRequest.historyRequests,
                updatedAt: new Date().toISOString()
              };

              const filePath = path.join(API_FOLDER, file);
              logger.info(`Updating existing request file: ${filePath}`);
              await fs.writeFile(filePath, JSON.stringify(mergedRequest, null, 2));
              updated++;
              isDuplicate = true;
              break;
            }
          } catch (fileError) {
            logger.warn(`Error reading file ${file} for duplicate check`, fileError);
          }
        }

        if (!isDuplicate) {
          // Create the file for new request
          const filename = `${validatedRequest.routeId}.json`;
          const filePath = path.join(API_FOLDER, filename);

          logger.info(`Creating new request file: ${filePath}`);
          await fs.writeFile(filePath, JSON.stringify(validatedRequest, null, 2));
          success++;
        }
      } catch (error) {
        logger.error(`Error creating request ${request.name}`, error);
        failure++;
      }
    }

    logger.info(`Request creation completed: ${success} created, ${updated} updated, ${failure} failed`);
    return { success, failure, updated };
  }

  /**
   * Main method to process a GitHub repository
   */
  public static async processGithubRepo(
    githubUrl: string, 
    username: string, 
    password: string,
    projectName: string,
    wsdlPath: string = '',
    openApiPath: string = '',
    environments: ApiEnvironments = {}
  ): Promise<{
    type: 'REST' | 'SOAP' | 'UNKNOWN',
    requests: Request[],
    stats: { success: number, failure: number, updated: number }
  }> {
    logger.info(`Processing GitHub repository: ${githubUrl} for project: ${projectName}`);
    try {
      // Clone repository
      logger.debug('Starting repository clone');
      const repoDir = await this.cloneRepository(githubUrl, username, password);

      // Identify API type
      logger.debug('Identifying API type');
      let { type, mainFilePath } = await this.identifyApiType(repoDir);

      // If paths were provided, use them
      if (wsdlPath && type !== 'SOAP') {
        logger.debug(`Checking provided WSDL path: ${wsdlPath}`);
        const providedWsdlPath = path.join(repoDir, wsdlPath);
        if (fsSync.existsSync(providedWsdlPath)) {
          logger.info(`Using provided WSDL path: ${providedWsdlPath}`);
          type = 'SOAP';
          mainFilePath = providedWsdlPath;
        } else {
          logger.warn(`Provided WSDL path does not exist: ${providedWsdlPath}`);
        }
      }

      if (openApiPath && type !== 'REST') {
        logger.debug(`Checking provided OpenAPI path: ${openApiPath}`);
        const providedOpenApiPath = path.join(repoDir, openApiPath);
        if (fsSync.existsSync(providedOpenApiPath)) {
          logger.info(`Using provided OpenAPI path: ${providedOpenApiPath}`);
          type = 'REST';
          mainFilePath = providedOpenApiPath;
        } else {
          logger.warn(`Provided OpenAPI path does not exist: ${providedOpenApiPath}`);
        }
      }

      // Process based on API type
      let requests: Request[] = [];

      if (type === 'REST' && mainFilePath) {
        logger.info(`Processing REST API from ${mainFilePath}`);
        // Process OpenAPI
        const resolvedSpec = await this.resolveOpenApiReferences(mainFilePath, repoDir);
        requests = this.extractOpenApiRequests(resolvedSpec, environments);
        logger.info(`Extracted ${requests.length} REST API requests`);
      } else if (type === 'SOAP' && mainFilePath) {
        logger.info(`Processing SOAP API from ${mainFilePath}`);
        // Process WSDL
        const resolvedWsdl = await this.resolveWsdlReferences(mainFilePath, repoDir);
        requests = this.extractWsdlRequests(resolvedWsdl, environments);
        logger.info(`Extracted ${requests.length} SOAP API requests`);
      } else {
        logger.warn(`Could not process API. Type: ${type}, mainFilePath: ${mainFilePath || 'not found'}`);
      }

      // Create requests in system
      logger.info(`Creating ${requests.length} requests in the system`);
      const stats = await this.createRequests(requests);
      logger.info(`Requests creation stats: ${stats.success} successful, ${stats.failure} failed, ${stats.updated} updated`);

      // Clean up
      try {
        logger.debug(`Cleaning up temporary directory: ${repoDir}`);
        fsSync.rmSync(repoDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Error cleaning up temporary directory', error);
      }

      return { type, requests, stats };
    } catch (error) {
      logger.error('Error processing GitHub repository', error);
      throw error;
    }
  }

  private static async ensureApiFolder() {
    logger.debug(`Ensuring API folder exists at ${API_FOLDER}`);
    try {
      await fs.access(API_FOLDER);
      logger.debug('API folder exists');
    } catch {
      logger.info(`Creating API folder at ${API_FOLDER}`);
      await fs.mkdir(API_FOLDER, { recursive: true });
    }
  }

  /**
   * Generate a sample header value based on parameter type and format
   */
  private static generateHeaderValue(param: any): string {
    if (!param || !param.schema) return '';
    
    // Check schema type
    const schema = param.schema;
    
    // Handle common header patterns based on name
    const name = param.name.toLowerCase();
    if (name.includes('authorization') || name.includes('token')) {
      return 'Bearer {token}';
    }
    
    if (name.includes('api-key') || name.includes('apikey')) {
      return '{api_key}';
    }
    
    if (name.includes('content-type')) {
      return 'application/json';
    }
    
    if (name.includes('accept')) {
      return 'application/json';
    }
    
    // Default value based on schema type
    switch(schema.type) {
      case 'string':
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0];
        }
        return 'string_value';
      case 'integer':
      case 'number':
        return '0';
      case 'boolean':
        return 'false';
      default:
        return '';
    }
  }
}