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

export async function saveRequest(request: Request): Promise<{ fileName: string; version: number }> {
  try {
    // Save the request
    const saveResponse = await fetch('/api/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      throw new Error(errorText || 'Failed to save request');
    }

    return saveResponse.json();
  } catch (error) {
    console.error('Error saving request:', error);
    throw error;
  }
}

export async function loadRequests(): Promise<Collection[]> {
  const response = await fetch('/api/requests');

  if (!response.ok) {
    throw new Error('Failed to load requests');
  }

  return response.json();
}

export async function getRequestByRouteId(routeId: string): Promise<Request> {
  const response = await fetch(`/api/requests/${routeId}`);

  if (!response.ok) {
    throw new Error('Failed to load request');
  }

  return response.json();
}

export async function listRequestFiles(): Promise<string[]> {
  const response = await fetch('/api/requests/files');

  if (!response.ok) {
    throw new Error('Failed to list request files');
  }

  return response.json();
}