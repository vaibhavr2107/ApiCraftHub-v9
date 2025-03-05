
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { ApiEnvironments } from './ApiDefinitionService';
import { Request } from '@shared/schema';

export class OpenApiService {
  /**
   * Resolves and merges external schemas for OpenAPI
   */
  public static async resolveOpenApiReferences(filePath: string, repoDir: string): Promise<any> {
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
   * Extracts requests from resolved OpenAPI definition
   */
  public static extractOpenApiRequests(apiSpec: any, environments: ApiEnvironments): Request[] {
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
                queryParams[param.name] = param.example || '';
              }
            });
          }

          // Extract headers
          const headers: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === 'header') {
                headers[param.name] = param.example || '';
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
}
