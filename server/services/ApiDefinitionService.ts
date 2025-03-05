
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Request } from '@shared/schema';

export import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

class ApiDefinitionService {
  static async processGithubRepo(
    githubUrl: string,
    username: string,
    password: string,
    projectName: string,
    wsdlPath?: string,
    openApiPath?: string,
    environments?: any
  ): Promise<any> {
    // Implementation for processing GitHub repo
    // This is a placeholder - the actual implementation would clone the repo and extract API definitions
    return {
      type: "REST",
      requests: [],
      stats: { success: 0, failure: 0 }
    };
  }

  static extractWsdlRequests(
    wsdlContent: string,
    environments: any
  ): Request[] {
    try {
      const requests: Request[] = [];

      // Extract service name
      const serviceNameMatch = wsdlContent.match(
        /<wsdl:service\s+name="([^"]+)"/,
      );
      const serviceName = serviceNameMatch
        ? serviceNameMatch[1]
        : "ImportedService";

      // Extract operations
      const operationRegex = /<wsdl:operation\s+name="([^"]+)"/g;
      let operationMatch;
      const operations = [];

      while ((operationMatch = operationRegex.exec(wsdlContent)) !== null) {
        operations.push(operationMatch[1]);
      }

      // For each operation, create a request
      operations.forEach((operation) => {
        const timestamp = new Date().getTime();
        const requestId = `soap-${operation.toLowerCase()}-${timestamp}`;

        // Create a simple SOAP envelope
        let requestBody = {
          "soap:Envelope": {
            "@xmlns:soap": "http://www.w3.org/2003/05/soap-envelope",
            "@xmlns:tem": "http://tempuri.org/",
            "soap:Header": {},
            "soap:Body": {
              [`tem:${operation}`]: {},
            },
          },
        };

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
            SOAPAction: `http://tempuri.org/${operation}`,
          },
          auth: { type: "none" },
          requestBody,
          responseFields: {},
          exampleResponseBody: {
            "soap:Envelope": {
              "soap:Body": {
                [`${operation}Response`]: {},
              },
            },
          },
          historyId: `history-${requestId}`,
          historyRequests: [],
          devUrl: environments.dev || "",
          qa01Url: environments.qa01 || "",
          qa02Url: environments.qa02 || "",
          qa03Url: environments.qa03 || "",
          perfUrl: environments.perf || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          selectedEnvironment: "qa01",
          tags: ["SOAP", serviceName],
          collectionId: serviceName.replace(/[^\w-]/g, "-"),
          collectionName: serviceName,
        };

        requests.push(request);
      });

      return requests;
    } catch (error) {
      console.error("Error extracting WSDL requests:", error);
      return [];
    }
  }

  static extractOpenApiRequests(
    apiSpec: any,
    environments: any
  ): Request[] {
    try {
      const requests: Request[] = [];

      if (!apiSpec.paths) {
        return requests;
      }

      const specTitle = apiSpec.info?.title || "Imported API";

      // Process each path and method
      Object.entries(apiSpec.paths).forEach(([path, pathItem]: [string, any]) => {
        // Skip if pathItem is not an object
        if (!pathItem || typeof pathItem !== "object") {
          return;
        }

        // Find all HTTP methods in this path
        const methods = Object.keys(pathItem).filter((key) =>
          ["get", "post", "put", "delete", "patch", "options", "head"].includes(
            key.toLowerCase(),
          ),
        );

        // Process each method
        methods.forEach((method) => {
          const operation = pathItem[method];
          if (!operation) return;

          // Generate a unique ID for this request
          const timestamp = new Date().getTime();
          const requestId = `${method.toLowerCase()}-${path.replace(/[^\w-]/g, "-")}-${timestamp}`;

          // Extract path parameters
          const pathParams: Record<string, string> = {};
          const pathParamMatches = path.match(/\{([^}]+)\}/g) || [];
          pathParamMatches.forEach((match) => {
            const paramName = match.substring(1, match.length - 1);
            pathParams[paramName] = "";
          });

          // Extract query parameters
          const queryParams: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === "query") {
                queryParams[param.name] = "";
              }
            });
          }

          // Extract headers
          const headers: Record<string, string> = {};
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              if (param.in === "header") {
                headers[param.name] = "";
              }
            });
          }

          // Create a request object
          const request: Request = {
            requestId,
            routeId: requestId,
            name:
              operation.summary ||
              operation.operationId ||
              `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            baseUrl: path,
            pathVariables: pathParams,
            queryParams,
            headers,
            auth: { type: "none" },
            requestBody:
              operation.requestBody?.content?.["application/json"]?.example || {},
            responseFields: {},
            exampleResponseBody: {},
            historyId: `history-${requestId}`,
            historyRequests: [],
            devUrl: environments.dev || "",
            qa01Url: environments.qa01 || "",
            qa02Url: environments.qa02 || "",
            qa03Url: environments.qa03 || "",
            perfUrl: environments.perf || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            selectedEnvironment: "qa01",
            tags: operation.tags || [],
            collectionId: specTitle.replace(/[^\w-]/g, "-"),
            collectionName: specTitle,
          };

          requests.push(request);
        });
      });

      return requests;
    } catch (error) {
      console.error("Error extracting OpenAPI requests:", error);
      return [];
    }
  }

  static async createRequests(
    requests: Request[]
  ): Promise<{ success: number; failure: number }> {
    let success = 0;
    let failure = 0;

    // Ensure API folder exists
    const API_FOLDER = path.join(process.cwd(), 'client', 'api');
    if (!fs.existsSync(API_FOLDER)) {
      fs.mkdirSync(API_FOLDER, { recursive: true });
    }

    // Save each request to a file
    for (const request of requests) {
      try {
        // Create the file
        const filename = `${request.routeId}.json`;
        const filePath = path.join(API_FOLDER, filename);

        fs.writeFileSync(filePath, JSON.stringify(request, null, 2));
        success++;
      } catch (error) {
        console.error(`Error creating request ${request.name}:`, error);
        failure++;
      }
    }

    return { success, failure };
  }
}
