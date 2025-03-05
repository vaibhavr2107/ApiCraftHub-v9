
import fs from 'fs/promises';
import path from 'path';
import { ApiEnvironments } from './ApiDefinitionService';
import { Request } from '@shared/schema';

export class WsdlService {
  /**
   * Merges XSD definitions for WSDL files
   */
  public static async resolveWsdlReferences(filePath: string, repoDir: string): Promise<string> {
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
   * Extracts requests from resolved WSDL definition
   */
  public static extractWsdlRequests(wsdlContent: string, environments: ApiEnvironments): Request[] {
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
}
