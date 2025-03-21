import express from "express";
import { z } from "zod";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { SpringParser } from "../parser/SpringParser";
import axios from "axios";
import yaml from "js-yaml";
import crypto from "crypto";
import https from "https";
import { Collection, Request, RequestSchema } from "@shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Import directories
const TEMP_DIR = path.join(__dirname, "../temp");
const API_FOLDER = path.join(__dirname, "../../client/api");
const IMPORTS_DIR = path.join(process.cwd(), "client", "imports");
const COLLECTIONS_DIR = path.join(process.cwd(), "client", "collections");

// Ensure directories exist
const ensureDirectories = () => {
  [TEMP_DIR, IMPORTS_DIR, COLLECTIONS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Validation schemas for different import types
const githubImportSchema = z.object({
  projectName: z.string(),
  projectType: z.enum(["REST", "SOAP", "BOTH"]),
  wsdlPath: z.string().optional(),
  openApiPath: z.string().optional(),
  devUrl: z.string().url().optional(),
  qa01Url: z.string().url().optional(),
  qa02Url: z.string().url().optional(),
  qa03Url: z.string().url().optional(),
  perfUrl: z.string().url().optional(),
  githubUrl: z.string().url(),
  username: z.string(),
  password: z.string(),
});

const wsdlImportSchema = z.object({
  url: z.string().url(),
});

const openApiImportSchema = z.object({
  url: z.string().url(),
});

const fileImportSchema = z.object({
  content: z.string(),
  fileName: z.string(),
});

import { ApiDefinitionService } from "../services/ApiDefinitionService";

// Add WSDL extraction helper
ApiDefinitionService.extractWsdlRequests = function (
  wsdlContent: string,
  environments: any,
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
};

// Add OpenAPI extraction helper
ApiDefinitionService.extractOpenApiRequests = function (
  apiSpec: any,
  environments: any,
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

        // Extract request body properly
        let requestBody = {};
        if (operation.requestBody?.content) {
          // Try application/json first
          if (operation.requestBody.content["application/json"]) {
            requestBody = operation.requestBody.content["application/json"].example || 
                        operation.requestBody.content["application/json"].schema?.example || 
                        {}; 
          } 
          // If no JSON body found, try other content types
          else {
            const contentTypes = Object.keys(operation.requestBody.content);
            if (contentTypes.length > 0) {
              const firstContentType = contentTypes[0];
              requestBody = operation.requestBody.content[firstContentType].example || 
                          operation.requestBody.content[firstContentType].schema?.example || 
                          {};
            }
          }
        }

        // Extract response examples if available
        let exampleResponseBody = {};
        if (operation.responses) {
          // Look for 200 OK response first
          const successResponse = operation.responses['200'] || 
                                operation.responses['201'] || 
                                operation.responses['default'];
          
          if (successResponse?.content?.["application/json"]) {
            exampleResponseBody = successResponse.content["application/json"].example || 
                               successResponse.content["application/json"].schema?.example || 
                               {};
          }
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
          auth: { type: "auth tiaa" }, // Set default auth type to "auth tiaa"
          requestBody,
          responseFields: {},
          exampleResponseBody,
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
          selectedEnvironment: "qa01", // Default environment is qa01
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
};

// Add this helper method for creating API requests from files
ApiDefinitionService.createRequests = async function (
  requests: Request[],
): Promise<{ success: number; failure: number }> {
  let success = 0;
  let failure = 0;

  // Ensure API folder exists
  if (!fs.existsSync(API_FOLDER)) {
    fs.mkdirSync(API_FOLDER, { recursive: true });
  }

  // Save each request to a file
  for (const request of requests) {
    try {
      // Validate request with schema
      const validatedRequest = RequestSchema.parse(request);

      // Create the file
      const filename = `${validatedRequest.routeId}.json`;
      const filePath = path.join(API_FOLDER, filename);

      fs.writeFileSync(filePath, JSON.stringify(validatedRequest, null, 2));
      success++;
    } catch (error) {
      console.error(`Error creating request ${request.name}:`, error);
      failure++;
    }
  }

  return { success, failure };
};

// GitHub import route
router.post("/github", async (req, res) => {
  try {
    const importData = githubImportSchema.parse(req.body);
    console.log("Starting GitHub import for project:", importData.projectName);

    // Generate import UUID
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Save import metadata
    const importMetadata = {
      id: importId,
      timestamp,
      type: "github",
      projectName: importData.projectName,
      projectType: importData.projectType,
      githubUrl: importData.githubUrl,
      environments: {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
    };

    ensureDirectories();

    // Save import metadata
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );

    // Ensure collections directory exists
    if (!fs.existsSync(COLLECTIONS_DIR)) {
      fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
    }

    // Process GitHub repository
    const result = await ApiDefinitionService.processGithubRepo(
      importData.githubUrl,
      importData.username,
      importData.password,
      importData.projectName,
      importData.wsdlPath,
      importData.openApiPath,
      {
        dev: importData.devUrl,
        qa01: importData.qa01Url,
        qa02: importData.qa02Url,
        qa03: importData.qa03Url,
        perf: importData.perfUrl,
      },
    );

    // Create collection
    const collection: Collection = {
      id: importId,
      name: importData.projectName,
      description: `Imported from GitHub: ${importData.githubUrl}`,
      requests: result.requests,
      importData: {
        source: "github",
        timestamp,
        projectType: result.type,
        stats: result.stats,
      },
    };

    // Save collection
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json({
      importId,
      collection,
      result,
    });
  } catch (error) {
    console.error("GitHub import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import from GitHub",
    });
  }
});

// WSDL import route
router.post("/wsdl", async (req, res) => {
  try {
    const { url } = wsdlImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch WSDL content
    const response = await axios.get(url);
    const wsdlContent = response.data;

    // Create a temporary file to store the WSDL
    ensureDirectories();
    const tempFilePath = path.join(TEMP_DIR, `${importId}.wsdl`);
    fs.writeFileSync(tempFilePath, wsdlContent);

    // Extract requests
    const requests = await ApiDefinitionService.extractWsdlRequests(
      wsdlContent,
      {
        dev: req.body.devUrl,
        qa01: req.body.qa01Url,
        qa02: req.body.qa02Url,
        qa03: req.body.qa03Url,
        perf: req.body.perfUrl,
      },
    );

    // Save requests
    const stats = await ApiDefinitionService.createRequests(requests);

    // Create a collection
    const urlObj = new URL(url);
    const serviceName =
      urlObj.pathname.split("/").pop()?.replace(".wsdl", "") || "WSDLService";

    const collection: Collection = {
      id: importId,
      name: `${serviceName} (WSDL)`,
      description: `Imported from WSDL: ${url}`,
      requests,
      importData: {
        source: "wsdl",
        timestamp,
        url: url,
        stats,
      },
    };

    const importMetadata = {
      id: importId,
      timestamp,
      type: "wsdl",
      url: url,
      stats,
    };

    // Save metadata and collection
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );

    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      collection,
      stats,
    });
  } catch (error) {
    console.error("WSDL import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import from WSDL",
    });
  }
});

// OpenAPI URL import route
router.post("/openapi", async (req, res) => {
  console.log("OpenAPI import request body:", req.body);
  try {
    // Validate request body with the correct schema using 'url' parameter
    const { url } = z
      .object({
        url: z.string().url("Invalid OpenAPI URL"),
      })
      .parse(req.body);

    // If we got here, we have a valid URL
    console.log(`Processing OpenAPI import from URL: ${url}`);

    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Fetch OpenAPI content with a timeout and disable certificate validation for testing
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Only reject if status >= 500
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    const content = response.data;

    console.log(`Successfully fetched OpenAPI content from ${url}`);

    let spec;
    try {
      spec = typeof content === "string" ? yaml.load(content) : content;
      console.log(`Successfully parsed content as ${typeof content === "string" ? "YAML" : "JSON"}`);
      console.log(`OpenAPI version: ${spec.openapi || spec.swagger}`);
      console.log(`API info:`, JSON.stringify(spec.info || {}).substring(0, 200));
      console.log(`Paths count: ${Object.keys(spec.paths || {}).length}`);
      console.log("OpenAPI Spec:", JSON.stringify(spec, null, 2)); //Added logging for the entire spec

    } catch (parseError) {
      console.error(`Error parsing OpenAPI content:`, parseError);
      return res.status(400).json({
        error: `Failed to parse OpenAPI specification: ${parseError.message}`
      });
    }

    // Get API title from spec
    const apiTitle = spec.info?.title || "OpenAPI";

    // Define environments from request body
    const environments = {
      dev: req.body.devUrl || "",
      qa01: req.body.qa01Url || "",
      qa02: req.body.qa02Url || "",
      qa03: req.body.qa03Url || "",
      perf: req.body.perfUrl || "",
    };

    // Extract requests
    const requests = ApiDefinitionService.extractOpenApiRequests(
      spec,
      environments,
    );

    // Save requests
    const stats = await ApiDefinitionService.createRequests(requests);

    // Save import metadata to client/import directory
    const importDir = path.join(process.cwd(), "client", "import");
    if (!fs.existsSync(importDir)) {
      fs.mkdirSync(importDir, { recursive: true });
    }

    // Save import details for reference
    fs.writeFileSync(
      path.join(importDir, `openapi-import-${importId}.json`),
      JSON.stringify(
        {
          id: importId,
          timestamp,
          url: url,
          environments,
          collectionName: apiTitle,
          requestCount: requests.length,
        },
        null,
        2,
      ),
    );

    // Create a collection
    const collection: Collection = {
      id: importId,
      name: apiTitle,
      description: `Imported from OpenAPI: ${url}`,
      requests,
      importData: {
        source: "openapi",
        timestamp,
        url: url,
        stats,
      },
    };

    const importMetadata = {
      id: importId,
      timestamp,
      type: "openapi",
      url: url,
      stats,
    };

    // Save metadata and collection
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );

    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json({
      collection,
      stats,
    });
  } catch (error) {
    console.error("OpenAPI import error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to import from OpenAPI",
    });
  }
});

// Collection file import route
router.post("/collection", async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const collection = JSON.parse(content);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Add import metadata
    collection.importData = {
      source: "file",
      timestamp: timestamp,
      fileName,
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: "file",
      fileName,
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json(collection);
  } catch (error) {
    console.error("Collection import error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to import collection",
    });
  }
});

// OpenAPI file import route
router.post("/openapi_file", async (req, res) => {
  try {
    const { content, fileName } = fileImportSchema.parse(req.body);
    const importId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Parse OpenAPI content
    const spec = yaml.load(content);

    // Create collection from OpenAPI spec
    const collection: Collection = {
      id: importId,
      name: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension
      description: `Imported from OpenAPI file: ${fileName}`,
      requests: [], // TODO: Convert OpenAPI paths to requests
      importData: {
        source: "openapi_file",
        timestamp: timestamp,
        fileName,
        spec,
      },
    };
    const importMetadata = {
      id: importId,
      timestamp,
      type: "openapi_file",
      fileName,
    };
    fs.writeFileSync(
      path.join(IMPORTS_DIR, `${importId}.json`),
      JSON.stringify(importMetadata, null, 2),
    );
    fs.writeFileSync(
      path.join(COLLECTIONS_DIR, `${collection.id}.json`),
      JSON.stringify(collection, null, 2),
    );

    res.json(collection);
  } catch (error) {
    console.error("OpenAPI file import error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to import OpenAPI file",
    });
  }
});

export default router;