
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import crypto from 'crypto';
import axios from 'axios';
import { Request, RequestSchema } from '@shared/schema';

const TEMP_DIR = path.join(process.cwd(), 'server', 'temp');
const API_FOLDER = path.join(process.cwd(), 'client', 'api');

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
    // Ensure temp directory exists
    try {
      await fs.access(TEMP_DIR);
    } catch {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    }

    // Ensure API folder exists
    try {
      await fs.access(API_FOLDER);
    } catch {
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
    await this.ensureDirectories();
    
    // Create a unique directory for this import
    const importId = crypto.randomUUID();
    const repoDir = path.join(TEMP_DIR, importId);
    
    // Clean up existing directory if it exists
    if (fsSync.existsSync(repoDir)) {
      fsSync.rmSync(repoDir, { recursive: true, force: true });
    }

    try {
      // Format git URL for authentication
      const gitUrl = githubUrl.replace('https://', '');
      const gitCommand = `git clone https://${username}:${password}@${gitUrl} ${repoDir}`;
      
      // Execute git clone command
      execSync(gitCommand);
      
      return repoDir;
    } catch (error) {
      console.error('Error cloning repository:', error);
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
      
      const allFiles = await getAllFiles(repoDir);
      
      // Look for OpenAPI files
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
      
      // Look for WSDL files
      const wsdlFiles = allFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.wsdl' || ext === '.xsd';
      });
      
      if (openApiFiles.length > 0) {
        // Find main OpenAPI file (prefer root-level files)
        const rootOpenApiFiles = openApiFiles.filter(file => {
          const relativePath = path.relative(repoDir, file);
          return !relativePath.includes(path.sep) || relativePath.split(path.sep).length <= 2;
        });
        
        const mainFilePath = rootOpenApiFiles.length > 0 ? rootOpenApiFiles[0] : openApiFiles[0];
        return { type: 'REST', mainFilePath };
      }
      
      if (wsdlFiles.length > 0) {
        // Find main WSDL file (look for .wsdl files, not .xsd)
        const wsdlOnlyFiles = wsdlFiles.filter(file => path.extname(file).toLowerCase() === '.wsdl');
        const mainFilePath = wsdlOnlyFiles.length > 0 ? wsdlOnlyFiles[0] : wsdlFiles[0];
        return { type: 'SOAP', mainFilePath };
      }
      
      return { type: 'UNKNOWN', mainFilePath: null };
    } catch (error) {
      console.error('Error identifying API type:', error);
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
      
      if (!apiSpec.paths) {
        return requests;
      }
      
      const specTitle = apiSpec.info?.title || 'Imported API';
      const specVersion = apiSpec.info?.version || '1.0.0';
      
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
                queryParams[param.name] = '';
              }
            });
          }
          
          // Extract headers
          const headers: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === 'header') {
                headers[param.name] = '';
              }
            });
          }
          
          // Extract request body
          let requestBody: any = {};
          if (operation.requestBody?.content) {
            const contentTypes = Object.keys(operation.requestBody.content);
            if (contentTypes.length > 0) {
              const contentType = contentTypes[0];  // Use the first content type
              const schema = operation.requestBody.content[contentType].schema;
              const example = operation.requestBody.content[contentType].example;
              
              if (example) {
                requestBody = example;
              } else if (schema) {
                // Generate sample from schema (simplified)
                requestBody = this.generateSampleFromSchema(schema, apiSpec);
              }
            }
          }
          
          // Extract response body
          let responseBody: any = {};
          if (operation.responses) {
            // Look for 200, 201, or the first response
            const successResponse = operation.responses['200'] || operation.responses['201'] || 
                                   Object.values(operation.responses)[0];
            
            if (successResponse?.content) {
              const contentTypes = Object.keys(successResponse.content);
              if (contentTypes.length > 0) {
                const contentType = contentTypes[0];
                const schema = successResponse.content[contentType].schema;
                const example = successResponse.content[contentType].example;
                
                if (example) {
                  responseBody = example;
                } else if (schema) {
                  // Generate sample from schema
                  responseBody = this.generateSampleFromSchema(schema, apiSpec);
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
            auth: { type: "none" },
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
            requestBody["soap:Envelope"]["soap:Body"][`tem:${operation}`][partName] = "";
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
          auth: { type: "none" },
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
    
    // Handle type
    switch (schema.type) {
      case 'object':
        const result: any = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
            result[propName] = this.generateSampleFromSchema(propSchema, fullSpec);
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
        return 'string';
        
      case 'number':
      case 'integer':
        return 0;
        
      case 'boolean':
        return false;
        
      default:
        return {};
    }
  }

  /**
   * Creates requests in the API system
   */
  private static async createRequests(requests: Request[]): Promise<{ success: number, failure: number }> {
    let success = 0;
    let failure = 0;
    
    // Ensure API folder exists
    await this.ensureApiFolder();
    
    // Save each request to a file
    for (const request of requests) {
      try {
        // Validate request with schema
        const validatedRequest = RequestSchema.parse(request);
        
        // Create the file
        const filename = `${validatedRequest.routeId}.json`;
        const filePath = path.join(API_FOLDER, filename);
        
        await fs.writeFile(filePath, JSON.stringify(validatedRequest, null, 2));
        success++;
      } catch (error) {
        console.error(`Error creating request ${request.name}:`, error);
        failure++;
      }
    }
    
    return { success, failure };
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
    stats: { success: number, failure: number }
  }> {
    try {
      // Clone repository
      const repoDir = await this.cloneRepository(githubUrl, username, password);
      
      // Identify API type
      let { type, mainFilePath } = await this.identifyApiType(repoDir);
      
      // If paths were provided, use them
      if (wsdlPath && type !== 'SOAP') {
        const providedWsdlPath = path.join(repoDir, wsdlPath);
        if (fsSync.existsSync(providedWsdlPath)) {
          type = 'SOAP';
          mainFilePath = providedWsdlPath;
        }
      }
      
      if (openApiPath && type !== 'REST') {
        const providedOpenApiPath = path.join(repoDir, openApiPath);
        if (fsSync.existsSync(providedOpenApiPath)) {
          type = 'REST';
          mainFilePath = providedOpenApiPath;
        }
      }
      
      // Process based on API type
      let requests: Request[] = [];
      
      if (type === 'REST' && mainFilePath) {
        // Process OpenAPI
        const resolvedSpec = await this.resolveOpenApiReferences(mainFilePath, repoDir);
        requests = this.extractOpenApiRequests(resolvedSpec, environments);
      } else if (type === 'SOAP' && mainFilePath) {
        // Process WSDL
        const resolvedWsdl = await this.resolveWsdlReferences(mainFilePath, repoDir);
        requests = this.extractWsdlRequests(resolvedWsdl, environments);
      }
      
      // Create requests in system
      const stats = await this.createRequests(requests);
      
      // Clean up
      try {
        fsSync.rmSync(repoDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Error cleaning up temporary directory:', error);
      }
      
      return { type, requests, stats };
    } catch (error) {
      console.error('Error processing GitHub repository:', error);
      throw error;
    }
  }
}
