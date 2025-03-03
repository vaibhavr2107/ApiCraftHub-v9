import type { ImportData } from "@/components/import-wizard";
import { Request, Collection } from "@shared/schema";
import { generateRouteId } from "@/lib/utils";

interface ImportedEndpoint {
  path: string;
  method: string;
  headers: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
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

    const importResults = await response.json();

    // Create import metadata
    const metadata: ImportMetadata = {
      serviceName: data.serviceName,
      timestamp: new Date().toISOString(),
      gitUrl: data.gitUrl,
      environments: {
        dev: data.devUrl,
        qa01: data.qa01Url,
        qa02: data.qa02Url,
        qa03: data.qa03Url,
        perf: data.perfUrl,
      },
      endpoints: importResults.endpoints,
    };

    // Save import metadata
    await saveImportMetadata(data.serviceName, metadata);

    // Generate and save API requests
    await generateApiRequests(metadata);

  } catch (error) {
    console.error('Import service error:', error);
    throw error;
  }
}

async function saveImportMetadata(serviceName: string, metadata: ImportMetadata): Promise<void> {
  try {
    const key = `import-${serviceName.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error saving import metadata:', error);
    throw error;
  }
}

async function generateApiRequests(metadata: ImportMetadata): Promise<void> {
  const timestamp = new Date().toISOString();
  const collectionId = `collection-${metadata.serviceName.toLowerCase()}`;

  const requests: Request[] = metadata.endpoints.map(endpoint => {
    const routeId = generateRouteId(`${metadata.serviceName}-${endpoint.method}-${endpoint.path}`);
    const name = `${endpoint.method} ${endpoint.path}`;

    return {
      requestId: routeId,
      routeId: routeId,
      name: name,
      method: endpoint.method,
      baseUrl: metadata.environments.qa01 + endpoint.path,
      headers: endpoint.headers || {},
      requestBody: endpoint.requestBody || {},
      exampleResponseBody: endpoint.responseBody || {},
      devUrl: metadata.environments.dev + endpoint.path,
      qa01Url: metadata.environments.qa01 + endpoint.path,
      qa02Url: metadata.environments.qa02 + endpoint.path,
      qa03Url: metadata.environments.qa03 + endpoint.path,
      perfUrl: metadata.environments.perf + endpoint.path,
      selectedEnvironment: 'qa01',
      historyRequests: [],
      historyId: `history-${routeId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      collectionId: collectionId,
      collectionName: metadata.serviceName,
      queryParams: {},
      pathVariables: {},
      responseFields: {},
      tags: [],
      auth: { type: 'bearer-tiaa' }
    };
  });

  // Create or update collection
  const collection: Collection = {
    id: collectionId,
    name: metadata.serviceName,
    description: `Imported from ${metadata.gitUrl}`,
    requests: requests,
    importData: metadata // Store import metadata for refresh functionality
  };

  // Save collection
  try {
    const existingCollections = JSON.parse(localStorage.getItem('collections') || '[]');
    const collectionIndex = existingCollections.findIndex((c: Collection) => c.id === collectionId);

    if (collectionIndex >= 0) {
      existingCollections[collectionIndex] = collection;
    } else {
      existingCollections.push(collection);
    }

    localStorage.setItem('collections', JSON.stringify(existingCollections));
  } catch (error) {
    console.error('Error saving collection:', error);
    throw error;
  }
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
    };

    await importService(importData);
  } catch (error) {
    console.error('Refresh service error:', error);
    throw error;
  }
}

// Placeholder for generateRouteId function - replace with actual implementation
function generateRouteId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '-');
}