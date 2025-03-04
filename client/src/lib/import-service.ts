import type { ImportData } from "@/components/import-wizard";
import { Request, Collection, RequestSchema } from "@shared/schema";
import { generateRouteId } from "@/lib/utils";
import yaml from 'js-yaml';

// Internal type for imported OpenAPI endpoint
interface OpenAPIEndpoint {
  path: string;
  method: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
}

// Internal type for imported collection endpoint
interface CollectionEndpoint {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  parameters?: any[];
}

export async function importService(data: ImportData): Promise<void> {
  try {
    console.log('Starting import for service:', data.serviceName);
    let importedEndpoints: Request[] = [];

    if (data.type === 'openapi') {
      console.log('Processing OpenAPI import...');
      importedEndpoints = await importOpenAPI(data);
    } else if (data.type === 'collection') {
      console.log('Processing Collection import...');
      importedEndpoints = await importCollection(data);
    } else {
      // Git repository scanning case
      console.log('Processing Git repository scan...');
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to import service');
      }

      const importResults = await response.json();
      importedEndpoints = convertScannedEndpoints(importResults.endpoints, data);
    }

    console.log(`Converted ${importedEndpoints.length} endpoints`);

    // Save as a collection
    const collection: Collection = {
      id: `collection-${data.serviceName.toLowerCase()}`,
      name: data.serviceName,
      description: `Imported from ${data.gitUrl || data.file?.name}`,
      requests: importedEndpoints,
      importData: {
        timestamp: new Date().toISOString(),
        source: data.gitUrl || data.file?.name,
        type: data.type
      }
    };

    // Save collection to localStorage
    await saveCollection(collection);
    console.log('Import completed successfully');

  } catch (error) {
    console.error('Import service error:', error);
    throw error;
  }
}

async function importOpenAPI(data: ImportData): Promise<Request[]> {
  if (!data.file) {
    throw new Error('No file provided for OpenAPI import');
  }

  const content = await data.file.text();
  let spec;

  try {
    // Try parsing as JSON first
    spec = JSON.parse(content);
  } catch {
    try {
      // If JSON fails, try YAML
      spec = yaml.load(content);
    } catch {
      throw new Error('Invalid OpenAPI specification format');
    }
  }

  if (!spec || !spec.paths) {
    throw new Error('Invalid OpenAPI specification');
  }

  const requests: Request[] = [];
  const timestamp = new Date().toISOString();

  // Process each path and method
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === 'parameters' || method === '$ref') continue;

      const endpoint: OpenAPIEndpoint = {
        path,
        method: method.toUpperCase(),
        description: operation.description,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses
      };

      const request = convertOpenAPIEndpoint(endpoint, data.serviceName, timestamp);
      requests.push(request);
    }
  }

  return requests;
}

async function importCollection(data: ImportData): Promise<Request[]> {
  if (!data.file) {
    throw new Error('No file provided for collection import');
  }

  const content = await data.file.text();
  let collection;

  try {
    collection = JSON.parse(content);
  } catch {
    throw new Error('Invalid collection format');
  }

  // Support different collection formats
  const items = collection.item || collection.requests || collection.items;
  if (!items) {
    throw new Error('No requests found in collection');
  }

  const requests: Request[] = [];
  const timestamp = new Date().toISOString();

  // Process each request in the collection
  for (const item of items) {
    if (!item.request) continue;

    const endpoint: CollectionEndpoint = {
      name: item.name,
      method: item.request.method,
      url: item.request.url.raw || item.request.url,
      headers: item.request.header,
      body: item.request.body,
      parameters: item.request.params
    };

    const request = convertCollectionEndpoint(endpoint, data.serviceName, timestamp);
    requests.push(request);
  }

  return requests;
}

function convertOpenAPIEndpoint(endpoint: OpenAPIEndpoint, serviceName: string, timestamp: string): Request {
  const requestId = generateRouteId(`${serviceName}-${endpoint.method}-${endpoint.path}`);

  return {
    requestId,
    routeId: requestId,
    name: `${endpoint.method} ${endpoint.path}`,
    method: endpoint.method,
    baseUrl: endpoint.path,
    headers: {},
    queryParams: {},
    pathVariables: {},
    requestBody: endpoint.requestBody?.content?.['application/json']?.schema || {},
    responseFields: endpoint.responses?.['200']?.content?.['application/json']?.schema || {},
    historyId: `history-${requestId}`,
    historyRequests: [],
    devUrl: '',
    qa01Url: '',
    qa02Url: '',
    qa03Url: '',
    perfUrl: '',
    selectedEnvironment: 'qa01',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    auth: { type: 'none' },
    tags: [],
    collectionId: `collection-${serviceName.toLowerCase()}`
  };
}

function convertCollectionEndpoint(endpoint: CollectionEndpoint, serviceName: string, timestamp: string): Request {
  const requestId = generateRouteId(`${serviceName}-${endpoint.method}-${endpoint.url}`);

  return {
    requestId,
    routeId: requestId,
    name: endpoint.name || `${endpoint.method} ${endpoint.url}`,
    method: endpoint.method,
    baseUrl: endpoint.url,
    headers: endpoint.headers || {},
    queryParams: {},
    pathVariables: {},
    requestBody: endpoint.body || {},
    responseFields: {},
    historyId: `history-${requestId}`,
    historyRequests: [],
    devUrl: '',
    qa01Url: '',
    qa02Url: '',
    qa03Url: '',
    perfUrl: '',
    selectedEnvironment: 'qa01',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    auth: { type: 'none' },
    tags: [],
    collectionId: `collection-${serviceName.toLowerCase()}`
  };
}

function convertScannedEndpoints(endpoints: any[], data: ImportData): Request[] {
  const timestamp = new Date().toISOString();

  return endpoints.map(endpoint => {
    const requestId = generateRouteId(`${data.serviceName}-${endpoint.method}-${endpoint.path}`);

    return {
      requestId,
      routeId: requestId,
      name: `${endpoint.method} ${endpoint.path}`,
      method: endpoint.method,
      baseUrl: endpoint.path,
      headers: endpoint.headers || {},
      queryParams: {},
      pathVariables: {},
      requestBody: endpoint.requestBody || {},
      responseFields: endpoint.responseBody || {},
      historyId: `history-${requestId}`,
      historyRequests: [],
      devUrl: data.devUrl + endpoint.path,
      qa01Url: data.qa01Url + endpoint.path,
      qa02Url: data.qa02Url + endpoint.path,
      qa03Url: data.qa03Url + endpoint.path,
      perfUrl: data.perfUrl + endpoint.path,
      selectedEnvironment: 'qa01',
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      auth: { type: 'none' },
      tags: [],
      collectionId: `collection-${data.serviceName.toLowerCase()}`
    };
  });
}

async function saveCollection(collection: Collection): Promise<void> {
  try {
    // Get existing collections
    const existingCollections = JSON.parse(localStorage.getItem('collections') || '[]');

    // Check if collection already exists
    const collectionIndex = existingCollections.findIndex((c: Collection) => c.id === collection.id);

    if (collectionIndex >= 0) {
      // Update existing collection
      existingCollections[collectionIndex] = collection;
    } else {
      // Add new collection
      existingCollections.push(collection);
    }

    // Save back to localStorage
    localStorage.setItem('collections', JSON.stringify(existingCollections));

    console.log(`Collection ${collection.name} saved successfully`);
  } catch (error) {
    console.error('Error saving collection:', error);
    throw error;
  }
}

// Placeholder for generateRouteId function - replace with actual implementation
function generateRouteId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export async function refreshServiceImport(serviceName: string): Promise<void> {
  try {
    const key = `import-${serviceName.toLowerCase()}`;
    const savedMetadata = localStorage.getItem(key);

    if (!savedMetadata) {
      throw new Error('Import metadata not found');
    }

    const metadata: ImportMetadata = JSON.parse(savedMetadata);

    // Re-import using saved credentials (in a real implementation, 
    // you would need to securely store and retrieve credentials)
    const importData: ImportData = {
      serviceName: metadata.serviceName,
      gitUrl: metadata.gitUrl,
      devUrl: metadata.environments.dev,
      qa01Url: metadata.environments.qa01,
      qa02Url: metadata.environments.qa02,
      qa03Url: metadata.environments.qa03,
      perfUrl: metadata.environments.perf,
      username: '', // Would need secure credential storage
      password: '', // Would need secure credential storage
      type: '',
      file: null
    };

    await importService(importData);
  } catch (error) {
    console.error('Refresh service error:', error);
    throw error;
  }
}

interface ImportMetadata {
  serviceName: string;
  timestamp: string;
  gitUrl: string;
  environments: {
    dev: string;
    qa01: string;
    qa02: string;
    qa03: string;
    perf: string;
  };
  endpoints: ImportedEndpoint[];
}

interface ImportedEndpoint {
  path: string;
  method: string;
  headers: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
}