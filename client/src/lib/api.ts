import type { ResponseData } from "@/types/api-request";
import type { Request, Collection } from "@shared/schema";

interface RequestOptions {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function makeRequest({
  method,
  url,
  body,
  headers = {},
}: RequestOptions): Promise<ResponseData> {
  try {
    if (!url) {
      throw new Error("URL is required");
    }

    let requestUrl: string;
    try {
      requestUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(requestUrl);
    } catch (urlError) {
      throw new Error("Invalid URL format. Please check the URL and try again.");
    }

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        url: requestUrl,
        headers,
        body
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }

    return response.json();
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    throw new Error(errorMessage);
  }
}

// Generic API request function for internal API calls
export async function apiRequest(url: string, options: { method: string; body?: string; headers?: Record<string, string> }): Promise<any> {
  console.log('Making API request:', url, options);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

export async function saveRequest(request: Request): Promise<{ request: Request; message: string }> {
  try {
    // Validate request data
    if (!request.routeId || !request.name) {
      throw new Error('Invalid request data: routeId and name are required');
    }

    // Get existing request if any
    let existingRequest: Request | null = null;
    try {
      const response = await apiRequest(`/api/requests/${request.routeId}`, { method: 'GET' });
      if (response) {
        existingRequest = response;
      }
    } catch (error) {
      console.log('No existing request found:', error);
    }

    // Merge with existing request if available
    const updatedRequest = existingRequest ? {
      ...existingRequest,
      ...request,
      historyRequests: [...(request.historyRequests || []), ...(existingRequest.historyRequests || [])].slice(0, 5),
      updatedAt: new Date().toISOString()
    } : {
      ...request,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save the request
    const saveResponse = await apiRequest('/api/requests', {
      method: 'POST',
      body: JSON.stringify(updatedRequest)
    });

    return {
      request: saveResponse.request,
      message: saveResponse.message || 'Request saved successfully'
    };
  } catch (error) {
    console.error('Error saving request:', error);
    throw error instanceof Error ? error : new Error('Failed to save request');
  }
}

let loadedRequests: Collection[] | null = null;
let isLoadingRequests = false;
let loadRequestsPromise: Promise<Collection[]> | null = null;

export async function loadRequests(): Promise<Collection[]> {
  try {
    // Return cached requests if available
    if (loadedRequests) {
      return loadedRequests;
    }

    // If already loading, wait for the existing promise
    if (isLoadingRequests && loadRequestsPromise) {
      return loadRequestsPromise;
    }

    // Start loading
    isLoadingRequests = true;
    loadRequestsPromise = apiRequest('/api/requests', { method: 'GET' })
      .then(async requests => {
        loadedRequests = requests;
        isLoadingRequests = false;
        return requests;
      })
      .catch(error => {
        isLoadingRequests = false;
        loadRequestsPromise = null;
        throw error;
      });

    return loadRequestsPromise;
  } catch (error) {
    console.error('Error loading requests:', error);
    throw error instanceof Error ? error : new Error('Failed to load requests');
  }
}

export async function findRequestByRouteId(routeId: string): Promise<Request | null> {
  try {
    // Wait for requests to load
    const requests = await loadRequests();

    // Search for the request in all collections
    for (const collection of requests) {
      const request = collection.requests.find(r => r.routeId === routeId);
      if (request) {
        return request;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding request:', error);
    return null;
  }
}

export async function getRequestByRouteId(routeId: string): Promise<Request> {
  try {
    // Try to find in loaded requests first
    const existingRequest = await findRequestByRouteId(routeId);
    if (existingRequest) {
      return existingRequest;
    }

    // If not found, try to fetch from API
    const response = await apiRequest(`/api/requests/${routeId}`, { method: 'GET' });
    return response;
  } catch (error) {
    console.error('Error loading request:', error);
    throw error instanceof Error ? error : new Error('Failed to load request');
  }
}

export async function openRequest(routeId: string): Promise<Request> {
  try {
    const response = await apiRequest(`/api/requests/open/${routeId}`, { method: 'GET' });
    return response;
  } catch (error) {
    console.error('Error opening request:', error);
    throw error instanceof Error ? error : new Error('Failed to open request');
  }
}

export async function updateRequest(routeId: string, updates: Partial<Request>): Promise<Request> {
  try {
    const response = await apiRequest(`/api/requests/update/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.request;
  } catch (error) {
    console.error('Error updating request:', error);
    throw error instanceof Error ? error : new Error('Failed to update request');
  }
}

export async function listRequestFiles(): Promise<string[]> {
  try {
    const response = await apiRequest('/api/requests/files', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('Error listing request files:', error);
    throw error instanceof Error ? error : new Error('Failed to list request files');
  }
}