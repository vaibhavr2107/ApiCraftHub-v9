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
    // Validate URL
    if (!url) {
      throw new Error("URL is required");
    }

    // Ensure URL is properly formatted
    let requestUrl: string;
    try {
      requestUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(requestUrl); // Validate URL format
    } catch (urlError) {
      throw new Error("Invalid URL format. Please check the URL and try again.");
    }

    // Make request to proxy endpoint
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

    const proxyResponse = await response.json();
    return proxyResponse;

  } catch (error: any) {
    // Return formatted error
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    throw new Error(errorMessage);
  }
}

export async function saveRequest(request: Request): Promise<{ request: Request; message: string }> {
  try {
    // Validate request data
    if (!request.routeId || !request.name) {
      throw new Error('Invalid request data: routeId and name are required');
    }

    // Save the request
    const saveResponse = await fetch('/api/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json();
      throw new Error(errorData.message || 'Failed to save request');
    }

    const result = await saveResponse.json();

    if (!result.request) {
      throw new Error('Invalid response from server');
    }

    return {
      request: result.request,
      message: result.message || 'Request saved successfully'
    };
  } catch (error) {
    console.error('Error saving request:', error);
    throw error instanceof Error ? error : new Error('Failed to save request');
  }
}

export async function loadRequests(): Promise<Collection[]> {
  try {
    const response = await fetch('/api/requests');

    if (!response.ok) {
      throw new Error('Failed to load requests');
    }

    return response.json();
  } catch (error) {
    console.error('Error loading requests:', error);
    throw error instanceof Error ? error : new Error('Failed to load requests');
  }
}

export async function getRequestByRouteId(routeId: string): Promise<Request> {
  try {
    const response = await fetch(`/api/requests/${routeId}`);

    if (!response.ok) {
      throw new Error('Failed to load request');
    }

    return response.json();
  } catch (error) {
    console.error('Error loading request:', error);
    throw error instanceof Error ? error : new Error('Failed to load request');
  }
}

export async function listRequestFiles(): Promise<string[]> {
  try {
    const response = await fetch('/api/requests/files');

    if (!response.ok) {
      throw new Error('Failed to list request files');
    }

    return response.json();
  } catch (error) {
    console.error('Error listing request files:', error);
    throw error instanceof Error ? error : new Error('Failed to list request files');
  }
}