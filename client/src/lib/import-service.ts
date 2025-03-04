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

interface FileImportData {
  file: File;
  type: 'openapi' | 'collection';
}

export async function importFromFile(data: FileImportData): Promise<void> {
  try {
    console.log('Starting file import:', data.file.name);
    let importedEndpoints: Request[] = [];
    let collectionName = data.file.name.split('.')[0];

    if (data.type === 'openapi') {
      console.log('Processing OpenAPI import...');
      importedEndpoints = await importOpenAPI(data.file);
    } else {
      console.log('Processing Collection import...');
      importedEndpoints = await importCollection(data.file);
    }

    console.log(`Converted ${importedEndpoints.length} endpoints`);

    // Generate or reuse collection ID
    const collectionId = `collection-${collectionName.toLowerCase()}`;

    // Get existing collections
    const existingCollections = JSON.parse(localStorage.getItem('collections') || '[]');
    let collection = existingCollections.find((c: Collection) => c.id === collectionId);

    if (collection) {
      // Merge new requests with existing collection
      const existingRequestIds = new Set(collection.requests.map(r => r.routeId));
      const newRequests = importedEndpoints.filter(r => !existingRequestIds.has(r.routeId));
      collection.requests = [...collection.requests, ...newRequests];
      collection.updatedAt = new Date().toISOString();
    } else {
      // Create new collection
      collection = {
        id: collectionId,
        name: collectionName,
        description: `Imported from ${data.file.name}`,
        requests: importedEndpoints,
        importData: {
          timestamp: new Date().toISOString(),
          source: data.file.name,
          type: data.type
        }
      };
      existingCollections.push(collection);
    }

    // Save collections
    localStorage.setItem('collections', JSON.stringify(existingCollections));
    console.log('Import completed successfully');

  } catch (error) {
    console.error('Import file error:', error);
    throw error;
  }
}

async function importOpenAPI(file: File): Promise<Request[]> {
  const content = await file.text();
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
  const serviceName = file.name.split('.')[0];
  const collectionId = `collection-${serviceName.toLowerCase()}`;

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

      const request = await createRequest({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        serviceName,
        collectionId,
        timestamp,
        requestBody: endpoint.requestBody?.content?.['application/json']?.schema,
        responseBody: endpoint.responses?.['200']?.content?.['application/json']?.schema,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      requests.push(request);
    }
  }

  return requests;
}

async function importCollection(file: File): Promise<Request[]> {
  const content = await file.text();
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
  const serviceName = file.name.split('.')[0];
  const collectionId = `collection-${serviceName.toLowerCase()}`;

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

    const request = await createRequest({
      method: endpoint.method,
      path: endpoint.url,
      name: endpoint.name,
      serviceName,
      collectionId,
      timestamp,
      requestBody: endpoint.body?.raw ? JSON.parse(endpoint.body.raw) : undefined,
      headers: endpoint.headers
    });

    requests.push(request);
  }

  return requests;
}

async function createRequest({
  method,
  path,
  name,
  description,
  serviceName,
  collectionId,
  timestamp,
  requestBody,
  responseBody,
  headers
}: {
  method: string;
  path: string;
  name?: string;
  description?: string;
  serviceName: string;
  collectionId: string;
  timestamp: string;
  requestBody?: any;
  responseBody?: any;
  headers?: Record<string, string>;
}): Promise<Request> {
  const routeId = generateRouteId(`${serviceName}-${method}-${path}`);

  const request: Request = {
    requestId: routeId,
    routeId: routeId,
    name: name || `${method} ${path}`,
    description,
    method,
    baseUrl: path,
    headers: headers || {},
    queryParams: {},
    pathVariables: {},
    requestBody: requestBody || {},
    responseFields: responseBody || {},
    exampleResponseBody: {}, // Required by schema
    historyId: `history-${routeId}`,
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
    collectionId
  };

  return RequestSchema.parse(request);
}

export async function importService(data: ImportData): Promise<void> {
  try {
    // Make API call to backend to initiate Git scanning
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

    const result = await response.json();
    const serviceName = data.serviceName;
    const collectionId = `collection-${serviceName.toLowerCase()}`;

    // Convert scanned endpoints to requests
    const requests = result.endpoints.map((endpoint: any) => {
      const routeId = generateRouteId(`${serviceName}-${endpoint.method}-${endpoint.path}`);
      return RequestSchema.parse({
        requestId: routeId,
        routeId: routeId,
        name: `${endpoint.method} ${endpoint.path}`,
        method: endpoint.method,
        baseUrl: endpoint.path,
        headers: endpoint.headers || {},
        queryParams: {},
        pathVariables: {},
        requestBody: endpoint.requestBody || {},
        responseFields: endpoint.responseBody || {},
        exampleResponseBody: {},
        historyId: `history-${routeId}`,
        historyRequests: [],
        devUrl: data.devUrl + endpoint.path,
        qa01Url: data.qa01Url + endpoint.path,
        qa02Url: data.qa02Url + endpoint.path,
        qa03Url: data.qa03Url + endpoint.path,
        perfUrl: data.perfUrl + endpoint.path,
        selectedEnvironment: 'qa01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        auth: { type: 'none' },
        tags: [],
        collectionId
      });
    });

    // Create or update collection
    const collection: Collection = {
      id: collectionId,
      name: serviceName,
      description: `Imported from ${data.gitUrl}`,
      requests,
      importData: {
        timestamp: new Date().toISOString(),
        source: data.gitUrl,
        type: 'git'
      }
    };

    // Save collection
    const existingCollections = JSON.parse(localStorage.getItem('collections') || '[]');
    const collectionIndex = existingCollections.findIndex((c: Collection) => c.id === collectionId);

    if (collectionIndex >= 0) {
      existingCollections[collectionIndex] = collection;
    } else {
      existingCollections.push(collection);
    }

    localStorage.setItem('collections', JSON.stringify(existingCollections));

  } catch (error) {
    console.error('Import service error:', error);
    throw error;
  }
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